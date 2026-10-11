import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"

import type { AssetInspection, ModelAsset } from "./types.ts"

export async function inspectModelAsset(
  path: string,
  asset: ModelAsset,
  signal: AbortSignal,
): Promise<AssetInspection> {
  try {
    signal.throwIfAborted()
    const info = await stat(path)
    if (!info.isFile() || info.size !== asset.bytes) {
      return "invalid"
    }
    const hash = createHash("sha256")
    for await (const chunk of createReadStream(path, { signal })) {
      if (!Buffer.isBuffer(chunk)) {
        return "invalid"
      }
      hash.update(chunk)
    }
    if (hash.digest("hex") !== asset.sha256) {
      return "invalid"
    }
    return "valid"
  } catch (error) {
    signal.throwIfAborted()
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "missing"
    }
    return "invalid"
  }
}
