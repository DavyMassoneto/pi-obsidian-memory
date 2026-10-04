import type { Note } from "#/domain/note"

export interface StoredNote {
  note: Note
  hash: string
}

export type VaultFailureReason = "not-found" | "invalid" | "exists" | "conflict" | "not-writable"

export type VaultResult =
  | { succeeded: true; output: StoredNote }
  | { succeeded: false; reason: VaultFailureReason; problems: string[] }

export type RawFileResult = { succeeded: true; output: Buffer } | { succeeded: false }

export type ExistingFileResult = { succeeded: true; output: string } | { succeeded: false }

export type WriteResult = { succeeded: true } | { succeeded: false; code: string }

export type ErrorCodeResult = { succeeded: true; output: string } | { succeeded: false }
