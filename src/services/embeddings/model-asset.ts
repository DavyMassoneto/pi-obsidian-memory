import { randomUUID } from "node:crypto"
import { link, mkdir, open, unlink } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { downloadModelAsset } from "./asset-download.ts"
import { inspectModelAsset } from "./asset-inspection.ts"
import type { ModelAssetRequest, ModelCacheResult } from "./types.ts"

export async function provisionModelAsset(request: ModelAssetRequest): Promise<ModelCacheResult> {
  try {
    const path = join(request.directory, request.asset.path)
    const status = await inspectModelAsset(path, request.asset, request.signal)
    if (status === "valid") {
      return { succeeded: true, output: path }
    }
    if (status === "invalid" || !request.downloadConsent) {
      return { succeeded: false, status: "unavailable" }
    }
    await mkdir(dirname(path), { recursive: true })
    return await publishModelAsset(request, path)
  } catch {
    if (request.signal.aborted) {
      return { succeeded: false, status: "aborted" }
    }
    return { succeeded: false, status: "unavailable" }
  }
}

async function publishModelAsset(request: ModelAssetRequest, path: string): Promise<ModelCacheResult> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  const file = await open(temporary, "wx")
  let result: ModelCacheResult = { succeeded: false, status: "unavailable" }
  try {
    const valid = await downloadModelAsset(request, file)
    await file.sync()
    await file.close()
    request.signal.throwIfAborted()
    if (valid) {
      result = await linkModelAsset(request, temporary, path)
    }
  } catch {
    if (request.signal.aborted) {
      result = { succeeded: false, status: "aborted" }
    }
  } finally {
    try {
      await file.close()
      await unlink(temporary)
    } catch {
      result = { succeeded: false, status: "unavailable", cleanupFailed: true }
    }
  }
  return result
}

async function linkModelAsset(request: ModelAssetRequest, temporary: string, path: string): Promise<ModelCacheResult> {
  try {
    await link(temporary, path)
    return { succeeded: true, output: path }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      if ((await inspectModelAsset(path, request.asset, request.signal)) === "valid") {
        return { succeeded: true, output: path }
      }
    }
    return { succeeded: false, status: "unavailable" }
  }
}
