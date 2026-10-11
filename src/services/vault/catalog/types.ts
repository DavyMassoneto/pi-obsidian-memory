import type { VaultCatalogFailure, VaultEnumeration, VaultExportFile, VaultFileStat } from "#/domain"
import type { VaultContext } from "#/services/vault/context"
import type { Succeeded } from "#/shared"

export type {
  InspectedVaultFile,
  ParsedVaultNote,
  UnclosedVaultNote,
  VaultAlias,
  VaultCatalogEntry,
  VaultCatalogFailure,
  VaultEntryKind,
  VaultEnumeration,
  VaultEnumerationResult,
  VaultExportFailure,
  VaultExportFile,
  VaultExportResult,
  VaultFileRequest,
  VaultFileStat,
  VaultInspectionResult,
  VaultNoteAnalysis,
  VaultNoteProblems,
} from "#/domain"

export interface CatalogLocation {
  root: string
  path: string
}

export interface ResolvedCatalogEntry {
  absolutePath: string
  canonicalPath: string
  kind: "file" | "directory" | "other"
  stat: VaultFileStat
}

export interface CatalogFailureDetail {
  path: string
  scope: VaultCatalogFailure["scope"]
  reason: VaultCatalogFailure["reason"]
  problem: string
}

export interface CatalogOperation {
  path: string
  scope: VaultCatalogFailure["scope"]
}

export type CatalogRootResult = Succeeded<string> | VaultCatalogFailure
export type CatalogResolveResult = Succeeded<ResolvedCatalogEntry> | VaultCatalogFailure
export type CatalogBytesResult = Succeeded<VaultExportFile> | VaultCatalogFailure

export interface CatalogReadRequest {
  path: string
  expectedStat?: VaultFileStat
}

export interface CatalogWalk {
  vault: VaultContext
  root: string
  mode: "memory" | "export"
  pending: string[]
  inventory: VaultEnumeration
}

export interface CatalogWalkRequest {
  vault: VaultContext
  mode: CatalogWalk["mode"]
}
