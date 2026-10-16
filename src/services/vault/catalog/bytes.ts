import { open, stat } from "node:fs/promises"

import type { VaultCatalogFailure } from "#src/domain"
import type { VaultContext } from "#src/services/vault/context"
import { hashOf } from "#src/services/vault/filesystem"
import { catalogFailure, catalogIoFailure } from "./failures.ts"
import { resolveCatalogEntry, resolveCatalogRoot } from "./resolve.ts"
import { catalogStat, sameCatalogStat } from "./stat.ts"
import type { CatalogBytesResult, CatalogReadRequest, ResolvedCatalogEntry } from "./types.ts"

export async function readCatalogBytes(vault: VaultContext, request: CatalogReadRequest): Promise<CatalogBytesResult> {
  const root = await resolveCatalogRoot(vault)
  if (!root.succeeded) return root
  const resolved = await resolveCatalogEntry({ root: root.output, path: request.path })
  if (!resolved.succeeded) return resolved
  if (resolved.output.kind !== "file") {
    return catalogFailure({ path: request.path, scope: "file", reason: "not-file", problem: "Expected a regular file" })
  }
  try {
    return await readStableBytes(resolved.output, request)
  } catch (error) {
    if (error instanceof Error) return catalogIoFailure(error, { path: request.path, scope: "file" })
    throw error
  }
}

async function readStableBytes(entry: ResolvedCatalogEntry, request: CatalogReadRequest): Promise<CatalogBytesResult> {
  const before = entry.stat
  if (request.expectedStat && !sameCatalogStat(before, request.expectedStat)) return changed(request.path)
  const file = await open(entry.absolutePath, "r")
  try {
    const opened = catalogStat(await file.stat())
    if (!sameCatalogStat(before, opened)) return changed(request.path)
    const bytes = await file.readFile()
    const after = catalogStat(await file.stat())
    if (!sameCatalogStat(before, after)) return changed(request.path)
    if (!sameCatalogStat(after, catalogStat(await stat(entry.absolutePath)))) return changed(request.path)
    return { succeeded: true, output: { path: request.path, bytes, rawHash: hashOf(bytes), stat: after } }
  } finally {
    await file.close()
  }
}

function changed(path: string): VaultCatalogFailure {
  return catalogFailure({
    path,
    scope: "file",
    reason: "changed",
    problem: "The file changed while collecting its snapshot",
  })
}
