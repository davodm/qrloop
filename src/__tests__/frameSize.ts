import { Buffer } from "buffer";
import {
  dataToFrames,
  maxFrameBinaryLength,
  FOUNTAIN_V1,
  MAX_FOUNTAIN_DEGREE,
  FOUNTAIN_HEADROOM,
} from "..";

test("exported frames stay within phone-scannable binary size", () => {
  const sizes = [0, 100, 1000, 12_000, 50_000, 99_999];
  const dataSizes = [100, 120, 200];

  for (const payloadSize of sizes) {
    for (const dataSize of dataSizes) {
      const data = Buffer.from(
        Array(payloadSize)
          .fill(null)
          .map((_, i) => i % 256)
      );
      const frames = dataToFrames(data, dataSize, 2);
      const limit = maxFrameBinaryLength(dataSize);
      expect(limit).toBeLessThanOrEqual(dataSize + FOUNTAIN_HEADROOM);
      expect(limit).toBeGreaterThanOrEqual(5 + dataSize);

      for (const frame of frames) {
        const bin = Buffer.from(frame, "base64");
        expect(bin.length).toBeLessThanOrEqual(limit);

        if (bin.readUInt8(0) === FOUNTAIN_V1) {
          const k = bin.readUInt16BE(1);
          expect(k).toBeLessThanOrEqual(MAX_FOUNTAIN_DEGREE);
          expect(3 + 2 * k + dataSize).toBeLessThanOrEqual(limit);
        }
      }
    }
  }
});
