import { createHash } from "node:crypto"
import { link, open, rename, unlink } from "node:fs/promises"

import { readConfigSnapshot } from "./snapshot.ts"
import type {
  CheckConfigSnapshotResult,
  ConfigPublicationRequest,
  WriteConfigRequest,
  WriteConfigResult,
} from "./types.ts"

export async function checkConfigSnapshot(request: WriteConfigRequest): Promise<CheckConfigSnapshotResult> {
  const snapshot = await readConfigSnapshot(request)
  if (!snapshot.succeeded) {
    return { ...snapshot, reason: "unavailable", warnings: [] }
  }
  if (snapshot.output.hash !== request.expectedHash) {
    return { succeeded: false, reason: "conflict", problems: ["config changed since it was read"], warnings: [] }
  }
  if (
    snapshot.output.state === "present" &&
    snapshot.output.repair.replacementRequired &&
    !request.replacementConfirmed
  ) {
    return {
      succeeded: false,
      reason: "replacement-required",
      problems: ["invalid JSON requires explicit replacement confirmation"],
      warnings: [],
    }
  }
  return snapshot
}

export async function publishConfig(context: ConfigPublicationRequest): Promise<WriteConfigResult> {
  const { request, temporaryPath, warnings } = context
  const text = `${JSON.stringify(request.config, null, 2)}\n`
  const handle = await open(temporaryPath, "wx")
  try {
    try {
      await handle.writeFile(text, "utf8")
      await handle.sync()
    } finally {
      await handle.close()
    }
    return await installConfig(context, text)
  } finally {
    await removeConfigArtifact(temporaryPath, warnings)
  }
}

async function installConfig(context: ConfigPublicationRequest, text: string): Promise<WriteConfigResult> {
  const { request, temporaryPath, warnings } = context
  const snapshot = await checkConfigSnapshot(request)
  if (!snapshot.succeeded) {
    return { ...snapshot, warnings }
  }
  if (snapshot.output.state === "missing") {
    await link(temporaryPath, request.path)
  } else {
    await rename(temporaryPath, request.path)
  }
  return { succeeded: true, output: { hash: createHash("sha256").update(text).digest("hex") }, warnings }
}

export async function removeConfigArtifact(path: string, warnings: string[]): Promise<void> {
  try {
    await unlink(path)
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return
    }
    warnings.push(`${path}: could not remove registration artifact (${String(error)})`)
  }
}
