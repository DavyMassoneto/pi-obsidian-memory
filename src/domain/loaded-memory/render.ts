import {
  INVALID_GONE,
  INVALID_UNREADABLE,
  INVALID_UNUSABLE,
  NOTE_FIELD_SEPARATOR,
  NOTE_HEADING_PREFIX,
} from "./constants.ts"
import type { InvalidReason, LoadedNote } from "./types.ts"

export function loadedNoteBlock(note: LoadedNote): string {
  return `${NOTE_HEADING_PREFIX}${[note.vault, note.path, note.type].join(NOTE_FIELD_SEPARATOR)}\n${note.body}`
}

export function replacementBlock(previous: LoadedNote, current: LoadedNote): string {
  return `This replaces the earlier copy of "${location(previous)}" loaded above; use this version and ignore the earlier one.\n\n${loadedNoteBlock(current)}`
}

export function invalidatedBlock(previous: LoadedNote, reason: InvalidReason): string {
  return `The earlier copy of "${location(previous)}" loaded above is no longer valid: ${reasonText(reason)}. Do not rely on it.`
}

function reasonText(reason: InvalidReason): string {
  if (reason.kind === "gone") return INVALID_GONE
  if (reason.kind === "unusable") return `${INVALID_UNUSABLE} (${reason.problem})`
  return `${INVALID_UNREADABLE} (${reason.problem})`
}

function location(note: LoadedNote): string {
  return [note.vault, note.path].join(NOTE_FIELD_SEPARATOR)
}
