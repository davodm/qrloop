import { Buffer } from "buffer";

export function toBuffer(dataOrStr: Buffer | string): Buffer {
  if (typeof dataOrStr === "string") {
    return Buffer.from(dataOrStr, "utf8");
  }
  const out = Buffer.alloc(dataOrStr.length);
  out.set(dataOrStr);
  return out;
}

export function concatBuffers(parts: Buffer[]): Buffer {
  return Buffer.concat(parts as unknown as Uint8Array[]);
}

export function cutAndPad(data: Buffer, size: number): Buffer[] {
  const numChunks = Math.ceil(data.length / size);
  const chunks: Buffer[] = new Array(numChunks);
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    const end = Math.min(o + size, data.length);
    const chunk = Buffer.alloc(end - o);
    chunk.set(data.subarray(o, end));
    chunks[i] = chunk;
  }
  const last = numChunks - 1;
  const pad = size - chunks[last].length;
  if (pad > 0) {
    chunks[last] = concatBuffers([chunks[last], Buffer.alloc(pad)]);
  }
  return chunks;
}

export function xor(buffers: Buffer[]): Buffer {
  const result = Buffer.alloc(buffers[0].length);
  result.set(buffers[0]);
  for (let i = 1; i < buffers.length; ++i) {
    const buffer = buffers[i];
    for (let j = 0; j < buffer.length; ++j) {
      result[j] ^= buffer[j];
    }
  }
  return result;
}
