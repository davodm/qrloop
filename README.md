# qrloop

Envelop a big blob of data into frames that can be displayed as a series of QR codes.

> Maintained fork of the archived [`gre/qrloop`](https://github.com/gre/qrloop) library. Same wire format (base64 frames + `FOUNTAIN_V1`), with bounded fountain degrees so large payloads stay phone-scannable.

> NB. this library is generic enough to not even be used with QR Codes but still take optimization decisions with regard to how QR codes work and from empirical tests.

## Install

### for Web or Electron

```
yarn add qrloop
```

### for React Native

```
yarn add qrloop
yarn add buffer   # required
```

## API

There are 2 parts of the library: the **exporter** that encodes data into QR frames, and the **importer** that scans those QR codes and accumulates frames until it reaches the final result.

### exporter

Main entry point: `dataToFrames`.

```js
import { dataToFrames, dataSizeForFrameCount } from "qrloop";

const frames = dataToFrames("hello world");
const framesFromBytes = dataToFrames(Buffer.from([0x00, 0x01]));
const framesTuned = dataToFrames(data, 140, 2);

// Aim for about N data chunks (fountain frames may still appear in the loop):
const dataSize = dataSizeForFrameCount(data, 6);
const exactish = dataToFrames(data, dataSize, 1);
```

```
dataToFrames(data[, dataSize, loops])
// data: Buffer | string — complete payload
// dataSize: bytes of payload per data frame (default 120; 100–200 works best on phones)
// loops: (>= 1) repeat with varying nonce + fountain frames
```

Examples:

- [`examples/web-exporter`](examples/web-exporter) — text or **binary file** → looping QR stream (Vite)

### importer

Feed each scanned QR string into `parseFramesReducer` and read progress with the helpers:

```js
import {
  parseFramesReducer,
  areFramesComplete,
  framesToData,
  progressOfFrames,
  indexesOfFrames,
  missingIndexesOfFrames,
} from "qrloop";

let frames = null;

const onBarCodeScanned = (data) => {
  try {
    frames = parseFramesReducer(frames, data);
    if (areFramesComplete(frames)) {
      console.log(framesToData(frames).toString());
    } else {
      console.log("Progress:", progressOfFrames(frames));
      console.log("Have:", indexesOfFrames(frames));
      console.log("Missing:", missingIndexesOfFrames(frames));
    }
  } catch (e) {
    console.warn(e);
  }
};
```

Examples:

- [`examples/web-importer`](examples/web-importer) — browser camera importer (`BarcodeDetector` + jsQR fallback)

Bring your own React Native / native scanner and call the same importer API.

## Trade-offs

### You do not need this if…

- Your data always fits in one QR code (check QR limits and test on phones).
- You have network access, no privacy constraint, and can store the blob on a server behind a token.

### Finding the correct QRCode `dataSize`

Empirical tests found **100–200 bytes/frame** works best. Above ~200, phone scan reliability drops. Very small frames (<50) are not meaningfully easier than ~150.

### Troubleshooting frames not getting caught

This is a unidirectional stream: the emitter loops until the reader has everything. Last frames are statistically hardest.

- Cap display rate around **5 fps** (phones can sample faster, but slower loops catch more).
- Use `loops > 1` for nonce “replicas” that reshape hard-to-read QR patterns.
- Fountain frames (Luby-inspired XOR) recover missing pieces faster. In 1.5.0+, fountain degree is **bounded** so frames stay within a scannable size even for large payloads.

### base64 on each frame

Binary QR payloads are still awkward on iOS AVFoundation (`stringValue` is the reliable path; raw bytes need `CIQRCodeDescriptor` bitstream parsing). Android can expose raw bytes, but cross-platform scanners and the web `BarcodeDetector` are string-oriented. **Base64 remains the default wire format** for interoperability. The overhead is acceptable.

### Data validation

On top of QR ECC, each payload is wrapped with length + MD5. Continued scanning can recover from corrupted intermediate state.

### Encoding complex objects

`JSON.stringify`, optionally compressed (gzip, LZW, etc.), then `dataToFrames`.

## Development

```bash
yarn
yarn test
yarn build
```

Node 18+ (CI uses Node 20).

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT — original work by Gaëtan Renaudeau; maintained fork contributions under the same license.
