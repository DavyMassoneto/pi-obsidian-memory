import type { AppliedWrite, ExplicitSave } from "#src/usecases/capture-memory"

export function writtenNote(write: AppliedWrite): ExplicitSave | null {
  if (write.status !== "applied" || write.operation === "archive") return null
  return { vault: write.vault, path: write.path }
}

function archivedBy(applied: AppliedWrite[], note: ExplicitSave): boolean {
  return applied.some(
    (write) =>
      write.status === "applied" &&
      write.operation === "archive" &&
      write.vault === note.vault &&
      write.path === note.path,
  )
}

export function changedNotes(applied: AppliedWrite[], owed: ExplicitSave[]): ExplicitSave[] {
  const notes: ExplicitSave[] = []
  const candidates = [...owed.filter((note) => !archivedBy(applied, note))]
  for (const write of applied) {
    const note = writtenNote(write)
    if (note) candidates.push(note)
  }
  for (const note of candidates) {
    if (notes.some((kept) => kept.vault === note.vault && kept.path === note.path)) continue
    notes.push(note)
  }
  return notes
}
