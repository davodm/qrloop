# Changelog

## 1.5.0

Maintained fork of archived `gre/qrloop` (`1.4.1`).

### Fixes

- **Fountain frames for large payloads** — degree is now bounded (mostly 2–3, max 8) so fountain frames stay within a phone-scannable size (`dataSize + FOUNTAIN_HEADROOM`). Same `FOUNTAIN_V1` wire format; old importers still decode new streams ([upstream #36](https://github.com/gre/qrloop/issues/36)).
- Guard empty fountain interleave (no divide-by-zero).
- Correct `framesToData` error message (`invalid data`, not `invalid date`).
- Prefer `Buffer.subarray` / safe buffer copies under modern TypeScript.

### Features

- `indexesOfFrames` / `missingIndexesOfFrames` for per-frame progress UI ([upstream #25](https://github.com/gre/qrloop/issues/25)).
- `dataSizeForFrameCount` helper to target an approximate data-chunk count ([upstream #27](https://github.com/gre/qrloop/issues/27)).
- `maxFrameBinaryLength`, `WRAP_OVERHEAD`, and fountain constants exported for integrators.

### Tooling

- TypeScript 5, Jest 29, Node 20 CI.
- Package `"types"` field, `prepublishOnly` build, MIT `LICENSE` file.
- Removed dead Babel/Flow build script.

### Examples

- New Vite **web-exporter** (text + binary file) and **web-importer** (camera / BarcodeDetector + jsQR).
- Retired Expo SDK 40 and CRA examples.

## 1.4.1

Upstream release — TypeScript migration and declarations.
