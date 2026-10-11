import type { Note, NoteFrontmatter } from "#/domain/note"
import type { MemoryDraft } from "./types.ts"

export function newNote(draft: MemoryDraft, id: string, day: string): Note {
  const frontmatter: NoteFrontmatter = { id, type: draft.type, created: day, updated: day }

  if (draft.dontForget) {
    frontmatter.dontForget = true
  }

  return { statement: draft.statement, frontmatter, body: draft.body }
}
