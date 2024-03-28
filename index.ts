export async function createFileReadStream(path: string) {
  let bufferSize = 64 * 1024
  let handle;
  let incompleteBufs: Uint8Array[] = []
  let chunkBuf = new Uint8Array(bufferSize)
  return new ReadableStream({
    async start() {
      handle = await open(path)
    }
    async pull(controller) {
      await handle.read(chunkBuf, 0, len, pos - len)
      let parts = chunkBuf.split(nl)
      incompleteBufs.unshift(parts[0].copy())
      for (part of parts.shift(1).reverse()) {
        controller.enqueue(decode(part))
      }
    }
    cancel() {
      handle.close()
    }
  })
}
