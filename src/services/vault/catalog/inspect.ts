import {
  analyzeVaultNote,
  type InspectedVaultFile,
  isCatalogNotePath,
  isRootArchive,
  type VaultExportFile,
  type VaultFileRequest,
  type VaultInspectionResult,
} from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import { readCatalogBytes } from "./bytes.ts"
import { catalogFailure } from "./failures.ts"
import { resolveCatalogEntry, resolveCatalogRoot } from "./resolve.ts"

export async function inspectVaultFile(vault: VaultContext, request: VaultFileRequest): Promise<VaultInspectionResult> {
  const root = await resolveCatalogRoot(vault)
  if (!root.succeeded) return root
  const resolved = await resolveCatalogEntry({ root: root.output, path: request.path })
  if (!resolved.succeeded) return resolved
  const canonicalPath = resolved.output.canonicalPath
  if (resolved.output.kind !== "file" || ![request.path, canonicalPath].every(isCatalogNotePath)) {
    return catalogFailure({
      path: request.path,
      scope: "file",
      reason: "excluded",
      problem: "This path is not a memory note",
    })
  }

  const raw = await readCatalogBytes(vault, { ...request, expectedStat: resolved.output.stat })
  if (!raw.succeeded) return raw
  return { succeeded: true, output: inspectContent(vault, raw.output, canonicalPath) }
}

function inspectContent(vault: VaultContext, raw: VaultExportFile, canonicalPath: string): InspectedVaultFile {
  const text = Buffer.from(raw.bytes).toString("utf8")
  const archived = isRootArchive(raw.path) || isRootArchive(canonicalPath)
  const statement = canonicalPath.slice(canonicalPath.lastIndexOf("/") + 1, -3)
  const analysis = analyzeVaultNote({ statement, text, archived, limits: vault.limits })
  return { path: raw.path, canonicalPath, text, rawHash: raw.rawHash, stat: raw.stat, archived, analysis }
}
