import { randomUUID } from "node:crypto"
import { mkdir, open } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { canonicalizeRegistration } from "./canonicalize.ts"
import { checkConfigSnapshot, publishConfig, removeConfigArtifact } from "./publication.ts"
import type { WriteConfigRequest, WriteConfigResult } from "./types.ts"

export async function writeConfig(request: WriteConfigRequest): Promise<WriteConfigResult> {
  const canonical = await canonicalizeRegistration({
    config: request.config,
    configPath: request.path,
    indexPath: request.indexPath,
  })
  if (!canonical.succeeded) {
    return { ...canonical, reason: "invalid-config", warnings: [] }
  }
  const resolved = { ...request, path: canonical.output.configPath }
  try {
    await mkdir(dirname(resolved.path), { recursive: true })
    return await writeWithLock(resolved)
  } catch (error) {
    return { succeeded: false, reason: "unavailable", problems: [String(error)], warnings: [] }
  }
}

async function writeWithLock(request: WriteConfigRequest): Promise<WriteConfigResult> {
  const lockPath = join(dirname(request.path), `.${basename(request.path)}.lock`)
  const lock = await open(lockPath, "wx")
  const warnings: string[] = []
  try {
    return await writeCheckedConfig(request, warnings)
  } finally {
    try {
      await lock.close()
    } catch (error) {
      warnings.push(`${lockPath}: could not close lock (${String(error)})`)
    }
    await removeConfigArtifact(lockPath, warnings)
  }
}

async function writeCheckedConfig(request: WriteConfigRequest, warnings: string[]): Promise<WriteConfigResult> {
  const temporaryPath = join(dirname(request.path), `.${basename(request.path)}.tmp-${randomUUID()}`)
  try {
    const snapshot = await checkConfigSnapshot(request)
    if (!snapshot.succeeded) {
      return { ...snapshot, warnings }
    }
    return await publishConfig({ request, temporaryPath, warnings })
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return {
        succeeded: false,
        reason: "conflict",
        problems: ["config publication destination already exists"],
        warnings,
      }
    }
    return { succeeded: false, reason: "unavailable", problems: [String(error)], warnings }
  }
}
