import md5 from "md5";
import { Buffer } from "buffer";
import { cutAndPad, xor, toBuffer, concatBuffers } from "./Buffer";
import {
  MAX_NONCE,
  FOUNTAIN_V1,
  MAX_FOUNTAIN_DEGREE,
  FOUNTAIN_HEADROOM,
} from "./constants";

export function makeFountainFrame(
  dataChunks: Buffer[],
  selectedFrameIndexes: number[]
): string {
  const k = selectedFrameIndexes.length;
  const head = Buffer.alloc(3 + 2 * k);
  head.writeUInt8(FOUNTAIN_V1, 0);
  head.writeUInt16BE(k, 1);
  const selectedFramesData = [];
  for (let j = 0; j < k; j++) {
    const frameIndex = selectedFrameIndexes[j];
    selectedFramesData.push(dataChunks[frameIndex]);
    head.writeUInt16BE(frameIndex, 3 + 2 * j);
  }
  const data = xor(selectedFramesData);
  return concatBuffers([head, data]).toString("base64");
}

export function makeDataFrame({
  data,
  nonce,
  totalFrames,
  frameIndex,
}: {
  data: Buffer;
  nonce: number;
  totalFrames: number;
  frameIndex: number;
}): string {
  const head = Buffer.alloc(5);
  head.writeUInt8(nonce, 0);
  head.writeUInt16BE(totalFrames, 1);
  head.writeUInt16BE(frameIndex, 3);
  return concatBuffers([head, data]).toString("base64");
}

export function wrapData(data: Buffer): Buffer {
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const md5Buffer = Buffer.from(md5(new Uint8Array(data)), "hex");
  return concatBuffers([lengthBuffer, md5Buffer, data]);
}

/** Wrapped payload overhead: 4-byte length + 16-byte md5. */
export const WRAP_OVERHEAD = 20;

/**
 * Choose a dataSize so wrapped data lands in exactly `frameCount` data chunks.
 * Fountain frames may still appear in the display loop from dataToFrames.
 */
export function dataSizeForFrameCount(
  dataOrStr: Buffer | string,
  frameCount: number
): number {
  if (!Number.isInteger(frameCount) || frameCount < 1) {
    throw new Error("frameCount must be an integer >= 1");
  }
  const wrappedLength = toBuffer(dataOrStr).length + WRAP_OVERHEAD;
  return Math.ceil(wrappedLength / frameCount);
}

/**
 * Max binary length of any exported frame (pre-base64) for a given dataSize.
 * Data frames are 5 + dataSize; fountain frames are at most dataSize + FOUNTAIN_HEADROOM.
 */
export function maxFrameBinaryLength(dataSize: number): number {
  return Math.max(5 + dataSize, dataSize + FOUNTAIN_HEADROOM);
}

/**
 * Simple robust-soliton-inspired degree: mostly 2–3, occasionally higher, hard-capped.
 */
function fountainDegree(n: number, random: () => number): number {
  const maxK = Math.min(n, MAX_FOUNTAIN_DEGREE);
  if (maxK <= 1) return 1;
  const r = random();
  if (r < 0.5) return Math.min(2, maxK);
  if (r < 0.8) return Math.min(3, maxK);
  if (r < 0.95) return Math.min(4, maxK);
  return maxK;
}

function pickDistinctIndexes(
  n: number,
  k: number,
  random: () => number
): number[] {
  const picks: number[] = [];
  const used = new Set<number>();
  while (picks.length < k) {
    const i = Math.floor(random() * n);
    if (!used.has(i)) {
      used.add(i);
      picks.push(i);
    }
  }
  return picks.sort((a, b) => a - b);
}

/**
 * in one loop:
 * the data is prepend in the frames with this head:
 * 4 bytes: uint, data length
 * 16 bytes: md5 of data
 *
 * each frame is a base64 of:
 *   1 byte: nonce
 *   2 bytes: uint, total number of frames
 *   2 bytes: uint, index of frame
 *   variable data
 *
 * each "fountain" frame is base64 of:
 *   1 byte: fountain version
 *   2 bytes: number of K frames associated
 *   K times 2 bytes: the index of each frame
 *   variable data: the XOR of the frames data
 *
 * It inspires idea from https://en.wikipedia.org/wiki/Luby_transform_code
 */
function makeLoop(
  wrappedData: Buffer,
  dataSize: number,
  index: number,
  random: () => number
): string[] {
  const nonce = index % MAX_NONCE;
  const dataChunks = cutAndPad(wrappedData, dataSize);
  const fountains: string[] = [];
  if (dataChunks.length > 2) {
    const fcount = Math.max(1, Math.floor(dataChunks.length / 6));
    for (let i = 0; i < fcount; i++) {
      const k = fountainDegree(dataChunks.length, random);
      const distribution = pickDistinctIndexes(dataChunks.length, k, random);
      fountains.push(makeFountainFrame(dataChunks, distribution));
    }
  }
  const result: string[] = [];
  let j = 0;
  const fountainEach =
    fountains.length > 0
      ? Math.max(1, Math.floor(dataChunks.length / fountains.length))
      : 0;
  for (let i = 0; i < dataChunks.length; i++) {
    result.push(
      makeDataFrame({
        data: dataChunks[i],
        nonce,
        totalFrames: dataChunks.length,
        frameIndex: i,
      })
    );
    if (fountainEach > 0 && i % fountainEach === 0 && fountains[j]) {
      result.push(fountains[j++]);
    }
  }
  return result;
}

/**
 * Export data into one series of chunk of string that you can generate a QR with
 * @param dataOrStr the complete data to encode in a series of QR code frames
 * @param dataSize the number of bytes to use from data for each frame
 * @param loops number of loops to generate. more loops increase chance for readers to read frames
 */
export function dataToFrames(
  dataOrStr: Buffer | string,
  dataSize: number = 120,
  loops: number = 1
): string[] {
  // Simple deterministic RNG
  let seed = 1;
  function random() {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  const wrappedData = wrapData(toBuffer(dataOrStr));

  let r: string[] = [];
  for (let i = 0; i < loops; i++) {
    r = r.concat(makeLoop(wrappedData, dataSize, i, random));
  }
  return r;
}
