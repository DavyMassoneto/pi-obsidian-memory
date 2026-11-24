import { loadedNoteBlock } from "#src/services"
import { BLOCK_SEPARATOR, SESSION_INTRO } from "./constants.ts"
import type { LoadedStore, RetrievedMemory } from "./types.ts"

export function deliverSessionMemory(pending: RetrievedMemory, loaded: LoadedStore): RetrievedMemory {
  if (pending.changes.loaded.length === 0) return pending
  const notes = pending.changes.loaded.filter((note) => !loaded.has(note))
  for (const note of notes) loaded.remember(note)
  let text: string | null = null
  if (notes.length > 0) text = [SESSION_INTRO, ...notes.map(loadedNoteBlock)].join(BLOCK_SEPARATOR)
  return { text, notices: pending.notices, changes: { loaded: notes, forgotten: [] } }
}
