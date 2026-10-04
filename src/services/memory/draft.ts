import type { Note, NoteFrontmatter } from "#/domain/note"
import { today } from "#/services/clock"
import { newNoteId } from "#/services/id"
import type { MemoryDraft } from "./types.ts"

export function newNote(draft: MemoryDraft): Note {
  const day = today()
  const frontmatter: NoteFrontmatter = { id: newNoteId(), type: draft.type, created: day, updated: day }

  if (draft.dontForget) {
    frontmatter.dontForget = true
  }

  return { statement: draft.statement, frontmatter, body: draft.body }
}
