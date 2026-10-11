import { createHash } from "node:crypto"
import type { FileHandle } from "node:fs/promises"

import type { ModelAssetRequest } from "./types.ts"

export async function downloadModelAsset(request: ModelAssetRequest, file: FileHandle): Promise<boolean> {
  request.signal.throwIfAborted()
  const response = await request.transport({ path: request.asset.path, signal: request.signal })
  if (!response.ok || !response.body) {
    await response.body?.cancel()
    return false
  }
  const reader = response.body.getReader()
  try {
    return await writeModelAsset(request, file, reader)
  } finally {
    await reader.cancel()
    reader.releaseLock()
  }
}

async function writeModelAsset(
  request: ModelAssetRequest,
  file: FileHandle,
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<boolean> {
  const hash = createHash("sha256")
  let loaded = 0
  while (true) {
    request.signal.throwIfAborted()
    const chunk = await reader.read()
    if (chunk.done) {
      return loaded === request.asset.bytes && hash.digest("hex") === request.asset.sha256
    }
    loaded += chunk.value.byteLength
    if (loaded > request.asset.bytes) {
      return false
    }
    await file.writeFile(chunk.value)
    hash.update(chunk.value)
    if (request.onProgress) {
      request.onProgress({ loaded, total: request.asset.bytes })
    }
  }
}
