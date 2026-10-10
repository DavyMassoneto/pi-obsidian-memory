import type { Stats } from "node:fs"

import type { InvalidNote, Note, ParsedNote, PlacedNote, Succession } from "#/domain"
import type { Absent, Done, Failed, Succeeded } from "#/shared"

export interface StoredNote {
  note: Note
  hash: string
}

export interface FolderListing {
  subjects: string[]
  notes: Note[]
  invalid: InvalidNote[]
}

export interface ArchiveRequest {
  note: PlacedNote
  hashWhenRead: string
  today: string
}

export interface SucceedRequest {
  previous: PlacedNote
  hashWhenRead: string
  successor: PlacedNote
  today: string
}

export interface RelocationRequest {
  vault: string
  vaultName: string
  original: PlacedNote
  hashWhenRead: string
  written: PlacedNote[]
}

export type VaultFailureReason =
  | "not-found"
  | "invalid"
  | "exists"
  | "conflict"
  | "not-writable"
  | "outside-vault"
  | "vault-missing"

export interface VaultRefusal extends Failed {
  reason: VaultFailureReason
}

export interface NotWritable {
  succeeded: false
  code: string
}

export interface NeedsFixingNote extends Failed {
  reason: "needs-fixing"
  parsed: ParsedNote
  hash: string
}

export type VaultResult = Succeeded<StoredNote> | VaultRefusal

export type ReadNoteResult = VaultResult | NeedsFixingNote

export type CheckResult = Done | VaultRefusal

export type PlacedResult = Succeeded<PlacedNote> | VaultRefusal

export type SuccessionResult = Succeeded<Succession> | VaultRefusal

export type RefreshResult = Done | Failed

export type ResolveResult = Succeeded<string> | VaultRefusal

export type ListResult = Succeeded<FolderListing> | VaultRefusal

export type RawFileResult = Succeeded<Buffer> | Absent

export type LinkStatResult = Succeeded<Stats> | Absent

export type RealPathResult = Succeeded<string> | Absent

export type ExistingFileResult = Succeeded<string> | Absent

export type ErrorCodeResult = Succeeded<string> | Absent

export type WriteResult = Done | NotWritable
