import type { Note } from "#src/domain/note"

export interface PlacedNote {
  folder: string
  note: Note
}

export interface Succession {
  archived: PlacedNote
  successor: PlacedNote
}
