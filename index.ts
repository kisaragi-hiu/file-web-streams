import { open } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";

const decoder = new TextDecoder();

/** Copy bytes from `arrs` into a new concatenated Uint8Array. */
function concat(...arrs: Uint8Array[]) {
  let length = 0;
  let offset = 0;

  for (const arr of arrs) {
    length += arr.length;
  }

  const result = new Uint8Array(length);
  for (const arr of arrs) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

/**
 * Return indicies of newline bytes (LF) within `arr`, up until `limit`.
 */
function findLfIndicies(arr: Uint8Array, limit: number) {
  const indicies = [];
  for (let i = 0; i < limit; i++) {
    if (arr[i] === 10) {
      indicies.unshift(i);
    }
  }
  return indicies;
}

/**
 * Create a stream that reads `path` in lines from the end.
 * `path` is assumed to be UTF-8 encoded.
 */
export function createReverseReadLineStream(
  path: string,
): ReadableStream<string> {
  let bufferSize = 64 * 1024;
  let handle: FileHandle;
  /** Current position */
  let pos = 0;
  let incompleteBufs: Uint8Array[] = [];
  let chunkBuf = new Uint8Array(bufferSize);
  return new ReadableStream({
    async start() {
      handle = await open(path);
      // Start from the end of the file
      const stat = await handle.stat();
      pos = stat.size;
    },
    async pull(controller) {
      // We can only read forward, so we have to transform a backward read into
      // a forward one.
      // Reading 10 bytes backwards from position 100 is the same as reading 10
      // bytes forwards from position (100 - 10).
      //
      // Math.min(bufferSize, pos) will correctly handle when there is less than
      // bufferSize bytes left in the file.
      let len = Math.min(bufferSize, pos);
      if (len === 0) {
        handle.close();
        controller.close();
      }
      pos = pos - len;
      await handle.read(chunkBuf, 0, len, pos);
      // chunkBuf is now eg. [ ...bytes, \n, ...bytes ]
      //
      // - The last segment needs to be merged with the current content of
      //   incompleteBufs before being emitted.
      // - The first segment is incomplete, push it to incompleteBufs
      // - Other segments should be emitted in the right order.
      // - If there is only one segment (no newline), the entire thing is
      //   incomplete
      // FIXME: we only need the first and last indicies
      const indicies = findLfIndicies(chunkBuf, len);
      let lastIndex = bufferSize;
      if (indicies.length === 0) {
        // No newline, the entire thing is incomplete, copy and push to incompleteBufs
        incompleteBufs.unshift(chunkBuf.slice(0, len));
      } else {
        // Keep in mind indicies is reversed.
        indicies.forEach((index, ownIdx) => {
          const isLast = lastIndex === bufferSize;
          const isFirst = ownIdx === indicies.length - 1;
          const part = chunkBuf.subarray(index, lastIndex);
          if (isLast) {
            controller.enqueue(decoder.decode(concat(...incompleteBufs, part)));
            // This is legal, actually.
            incompleteBufs.length = 0;
          } else if (isFirst) {
            // Add to start, so that incompleteBufs is ordered from file start
            // to file end.
            incompleteBufs.unshift(part);
          } else {
            controller.enqueue(decoder.decode(part));
          }
        });
      }
    },
    cancel() {
      handle.close();
    },
  });
}
