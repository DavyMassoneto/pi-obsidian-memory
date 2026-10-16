import { loadedNoteBlock } from "./render.ts"
import type { LoadedNote } from "./types.ts"

export function fitBudget<Note extends LoadedNote>(notes: readonly Note[], budgetChars: number): Note[] {
  const fitted: Note[] = []
  let remaining = budgetChars
  for (const note of notes) {
    const size = loadedNoteBlock(note).length
    if (size > remaining) return fitted
    fitted.push(note)
    remaining -= size
  }
  return fitted
}
