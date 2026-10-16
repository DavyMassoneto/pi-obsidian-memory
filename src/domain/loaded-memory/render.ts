import type { LoadedNote } from "./types.ts"

export function loadedNoteBlock(note: LoadedNote): string {
  return `Note: ${note.path}\nStatement: ${note.statement}\n\n${note.body}`
}

export function replacementBlock(previous: LoadedNote, current: LoadedNote): string {
  return `This replaces the earlier copy of "${previous.path}" loaded above; use this version and ignore the earlier one.\n\n${loadedNoteBlock(current)}`
}

export function invalidatedBlock(previous: LoadedNote): string {
  return `The earlier copy of "${previous.path}" loaded above is no longer valid: the note was archived or deleted. Do not rely on it.`
}
