import { NOTE_FIELD_SEPARATOR, NOTE_HEADING_PREFIX } from "./constants.ts"
import type { LoadedNote } from "./types.ts"

export function loadedNoteBlock(note: LoadedNote): string {
  return `${NOTE_HEADING_PREFIX}${[note.vault, note.path, note.type].join(NOTE_FIELD_SEPARATOR)}\n${note.body}`
}

export function replacementBlock(previous: LoadedNote, current: LoadedNote): string {
  return `This replaces the earlier copy of "${location(previous)}" loaded above; use this version and ignore the earlier one.\n\n${loadedNoteBlock(current)}`
}

export function invalidatedBlock(previous: LoadedNote): string {
  return `The earlier copy of "${location(previous)}" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.`
}

function location(note: LoadedNote): string {
  return [note.vault, note.path].join(NOTE_FIELD_SEPARATOR)
}
