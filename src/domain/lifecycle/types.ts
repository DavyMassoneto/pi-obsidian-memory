import type { Note } from "#/domain/note"

export interface PlacedNote {
  folder: string
  note: Note
}

export interface Succession {
  archived: PlacedNote
  successor: PlacedNote
}
