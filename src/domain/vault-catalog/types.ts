import type { NoteFrontmatter, NoteLimits, ParsedNote } from "#src/domain/note"
import type { Failed, Succeeded } from "#src/shared"

export type VaultEntryKind = "note" | "folder" | "index" | "template" | "dashboard" | "temporary" | "other"

export interface VaultFileStat {
  size: number
  mtimeMs: number
  ctimeMs: number
  device: number
  inode: number
}

export interface VaultCatalogEntry {
  path: string
  kind: VaultEntryKind
  archived: boolean
  stat: VaultFileStat
}

export interface VaultCatalogFailure extends Failed {
  path: string
  scope: "file" | "directory" | "entry"
  reason:
    | "invalid-path"
    | "outside-vault"
    | "not-found"
    | "not-directory"
    | "not-file"
    | "unreadable"
    | "not-writable"
    | "cycle"
    | "excluded"
    | "changed"
    | "io-error"
}

export interface VaultAlias {
  path: string
  target: string
}

export interface VaultEnumeration {
  entries: VaultCatalogEntry[]
  observedPaths: string[]
  completeDirectories: string[]
  failures: VaultCatalogFailure[]
  aliases: VaultAlias[]
}

export type VaultEnumerationResult = Succeeded<VaultEnumeration> | VaultCatalogFailure

export interface AnalyzeVaultNoteRequest {
  statement: string
  text: string
  archived: boolean
  limits: NoteLimits
}

export interface VaultNoteProblems {
  frontmatterProblems: string[]
  nameProblems: string[]
  bodyProblems: string[]
}

export interface ParsedVaultNote extends VaultNoteProblems {
  status: "parsed"
  parsed: ParsedNote
  frontmatter: NoteFrontmatter | null
  searchable: boolean
  needsFixing: boolean
}

export interface UnclosedVaultNote extends VaultNoteProblems {
  status: "unclosed"
  searchable: false
  needsFixing: true
}

export type VaultNoteAnalysis = ParsedVaultNote | UnclosedVaultNote

export interface VaultFileRequest {
  path: string
}

export interface InspectedVaultFile {
  path: string
  canonicalPath: string
  text: string
  rawHash: string
  stat: VaultFileStat
  archived: boolean
  analysis: VaultNoteAnalysis
}

export type VaultInspectionResult = Succeeded<InspectedVaultFile> | VaultCatalogFailure

export interface VaultExportFile {
  path: string
  bytes: Uint8Array
  rawHash: string
  stat: VaultFileStat
}

export interface VaultExportEntry {
  path: string
  bytes: Uint8Array
}

export interface VaultExportFailure extends Failed {
  failures: VaultCatalogFailure[]
}

export type VaultExportResult = Succeeded<VaultExportFile[]> | VaultExportFailure
