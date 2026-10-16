import { join, resolve } from "node:path"

import { zipSync } from "fflate"

import { canonicalizeAccessPath, exportEntries, vaultAccessRefusal, writeNewFile } from "#src/services"
import {
  captureMemoryOperationContext,
  type MemoryOperationContext,
  memoryAdmissionRefusal,
  memoryOperationInterruption,
} from "#src/usecases/operation-context"
import { resolveLeasedMemory } from "#src/usecases/resolve-memory/leased"
import { collectVaults } from "./collect.ts"
import { EXPORT_EXTENSION, FILE_NAME_SEPARATORS } from "./constants.ts"
import type { ExportMemoryRequest, ExportMemoryResult } from "./types.ts"

export async function exportMemory(
  input: ExportMemoryRequest,
  callerContext: MemoryOperationContext,
): Promise<ExportMemoryResult> {
  const request = { folder: input.folder, fileName: input.fileName }
  const invalid = checkFileName(request.fileName)
  if (invalid) return { succeeded: false, reason: "invalid", problems: [invalid] }
  const context = captureMemoryOperationContext(callerContext)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) return memoryAdmissionRefusal(context)
  try {
    return await exportLeasedMemory(request, context)
  } finally {
    lease.release()
  }
}

async function exportLeasedMemory(
  request: ExportMemoryRequest,
  context: MemoryOperationContext,
): Promise<ExportMemoryResult> {
  const memory = await resolveLeasedMemory(context)
  if (!memory.succeeded) return memory
  const folder = resolve(context.workingFolder, request.folder)
  if (await isInsideVault(folder, memory.output.protectedRoots)) {
    return {
      succeeded: false,
      reason: "inside-vault",
      problems: [`${folder} is inside a vault; choose another folder`],
    }
  }
  const collected = await collectVaults(memory.output)
  if (collected.problems.length > 0) {
    return { succeeded: false, reason: "unreadable-files", problems: collected.problems }
  }
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  const entries = exportEntries(collected.global, collected.project)
  const archive = zipSync(Object.fromEntries(entries.map((entry) => [entry.path, entry.bytes])))
  const path = join(folder, request.fileName)
  const written = await writeNewFile(path, archive)
  if (!written.succeeded) return written
  const vaults = [memory.output.global.scope]
  if (collected.project) vaults.push("project")
  return { succeeded: true, output: { path, files: entries.length, vaults } }
}

async function isInsideVault(folder: string, vaults: string[]): Promise<boolean> {
  if (isInside(folder, vaults)) return true
  const canonical = await canonicalizeAccessPath(folder)
  if (!canonical.succeeded) return false
  return isInside(canonical.output, vaults)
}

function isInside(folder: string, vaults: string[]): boolean {
  return typeof vaultAccessRefusal({ kind: "file", path: folder }, folder, folder, vaults) === "string"
}

function checkFileName(fileName: string): string | null {
  if (fileName === "" || FILE_NAME_SEPARATORS.test(fileName)) {
    return "The file name must be a plain name with no folders"
  }
  if (!fileName.toLowerCase().endsWith(EXPORT_EXTENSION) || fileName.length === EXPORT_EXTENSION.length) {
    return `The file name must end with ${EXPORT_EXTENSION}`
  }
  return null
}
