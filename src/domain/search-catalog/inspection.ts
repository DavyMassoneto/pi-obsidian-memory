import type { InspectedVaultFile, VaultCatalogEntry, VaultCatalogFailure } from "#/domain/vault-catalog"
import { semanticFingerprint } from "./fingerprint.ts"
import type { AliasFailureClassification, CatalogEntry } from "./types.ts"

export function inspectedCatalogEntry(file: InspectedVaultFile, validationFingerprint: string): CatalogEntry {
  const entry: CatalogEntry = {
    path: file.path,
    stat: { size: file.stat.size, mtimeMs: file.stat.mtimeMs },
    rawHash: file.rawHash,
    contentFingerprint: null,
    validationFingerprint,
    note: null,
    needsFixing: file.analysis.needsFixing,
  }
  const analysis = file.analysis
  if (analysis.status !== "parsed" || !analysis.frontmatter) return entry
  entry.note = {
    id: analysis.frontmatter.id,
    type: analysis.frontmatter.type,
    statement: analysis.parsed.statement,
    body: analysis.parsed.body,
    dontForget: "dontForget" in analysis.frontmatter,
    archived: !analysis.searchable,
  }
  entry.contentFingerprint = semanticFingerprint(entry.note)
  return entry
}

export function reusableCatalogEntry(
  file: VaultCatalogEntry,
  cached: CatalogEntry,
  validationFingerprint: string,
): boolean {
  return (
    cached.validationFingerprint === validationFingerprint &&
    cached.stat.size === file.stat.size &&
    cached.stat.mtimeMs === file.stat.mtimeMs
  )
}

export function classifyAliasFailure(failure: VaultCatalogFailure): AliasFailureClassification {
  if (failure.reason === "excluded" || failure.reason === "cycle") {
    if (failure.scope === "file") return { kind: "excluded-file", path: failure.path }
    return { kind: "untraversed-directory", path: failure.path }
  }
  return { kind: "failed", path: failure.path, problems: failure.problems }
}
