import { Buffer } from "buffer";
import {
  dataToFrames,
  dataSizeForFrameCount,
  parseFramesReducer,
  indexesOfFrames,
  missingIndexesOfFrames,
  areFramesComplete,
  framesToData,
  WRAP_OVERHEAD,
} from "..";

test("indexesOfFrames and missingIndexesOfFrames", () => {
  expect(indexesOfFrames(null)).toEqual([]);
  expect(missingIndexesOfFrames(null)).toEqual([]);

  const data = Buffer.from(
    Array(800)
      .fill(null)
      .map((_, i) => i % 256)
  );
  const framesExport = dataToFrames(data, 100, 1);
  let state = null;
  for (const frame of framesExport) {
    state = parseFramesReducer(state, frame);
    const have = indexesOfFrames(state);
    const missing = missingIndexesOfFrames(state);
    expect(new Set([...have, ...missing]).size).toBe(have.length + missing.length);
    if (areFramesComplete(state)) break;
  }
  expect(areFramesComplete(state)).toBe(true);
  expect(missingIndexesOfFrames(state)).toEqual([]);
  expect(indexesOfFrames(state).length).toBeGreaterThan(0);
  expect(framesToData(state).toString("hex")).toBe(data.toString("hex"));
});

test("dataSizeForFrameCount yields the requested chunk count", () => {
  const data = Buffer.from("hello world ".repeat(200));
  for (const frameCount of [1, 2, 6, 10]) {
    const dataSize = dataSizeForFrameCount(data, frameCount);
    const wrapped = data.length + WRAP_OVERHEAD;
    expect(Math.ceil(wrapped / dataSize)).toBe(frameCount);
    const frames = dataToFrames(data, dataSize, 1);
    // data frames only: first byte < MAX_NONCE
    const dataFrames = frames.filter(
      (f) => Buffer.from(f, "base64").readUInt8(0) < 10
    );
    expect(dataFrames.length).toBe(frameCount);
  }
});

test("dataSizeForFrameCount rejects invalid frameCount", () => {
  expect(() => dataSizeForFrameCount("x", 0)).toThrow();
  expect(() => dataSizeForFrameCount("x", 1.5)).toThrow();
});
