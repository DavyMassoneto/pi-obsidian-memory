import type { Ledger, SavedNote, SessionRecord } from "./types.ts"

export function savedNotesIn(records: SessionRecord[], ledger: Ledger, ids: string[]): SavedNote[] {
  const wanted = new Set(ids)
  const notes: SavedNote[] = []
  const seen = new Set<number>()
  for (const range of ledger.ranges) {
    if (!range.observations.some((observation) => wanted.has(observation.id))) continue
    for (let index = range.from; index <= range.to; index++) seen.add(index)
  }
  for (const index of [...seen].sort((left, right) => left - right)) {
    const record = records[index]
    if (record?.kind === "message" && record.saved) notes.push(record.saved)
  }
  return notes
}
