import type { ReadObservation } from "#src/domain/memory-agent"

export type LoadedNote = Pick<ReadObservation, "vault" | "path" | "type" | "body">

export interface NoteGone {
  kind: "gone"
}

export interface NoteUnusable {
  kind: "unusable"
  problem: string
}

export interface NoteUnreadable {
  kind: "unreadable"
  problem: string
}

export type InvalidReason = NoteGone | NoteUnusable | NoteUnreadable
