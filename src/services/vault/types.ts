import type { InvalidNote } from "#/domain/folder-index"
import type { PlacedNote, Succession } from "#/domain/lifecycle"
import type { Note } from "#/domain/note"
import type { Absent, Done, Failed, Succeeded } from "#/shared/result"

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

export type VaultFailureReason = "not-found" | "invalid" | "exists" | "conflict" | "not-writable"

export interface VaultRefusal extends Failed {
  reason: VaultFailureReason
}

export interface NotWritable {
  succeeded: false
  code: string
}

export type VaultResult = Succeeded<StoredNote> | VaultRefusal

export type CheckResult = Done | VaultRefusal

export type PlacedResult = Succeeded<PlacedNote> | VaultRefusal

export type SuccessionResult = Succeeded<Succession> | VaultRefusal

export type RefreshResult = Done | Failed

export type RawFileResult = Succeeded<Buffer> | Absent

export type ExistingFileResult = Succeeded<string> | Absent

export type ErrorCodeResult = Succeeded<string> | Absent

export type WriteResult = Done | NotWritable
