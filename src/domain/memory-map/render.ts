import { MEMORY_MAP_INTRO } from "./constants.ts"
import type { MemoryMapNote } from "./types.ts"

export function renderMemoryMap(notes: MemoryMapNote[], budgetChars: number): string {
  if (MEMORY_MAP_INTRO.length > budgetChars) return ""
  const ordered = [...notes].sort(compareMapNotes)
  let text = MEMORY_MAP_INTRO
  for (const note of ordered) {
    const line = `\n${JSON.stringify({ vault: note.scope, id: note.id, path: note.path, statement: note.statement })}`
    if (text.length + line.length <= budgetChars) text += line
  }
  return text
}

function compareMapNotes(a: MemoryMapNote, b: MemoryMapNote): number {
  const scope = a.scope.localeCompare(b.scope)
  if (scope !== 0) return scope
  return a.path.localeCompare(b.path)
}
