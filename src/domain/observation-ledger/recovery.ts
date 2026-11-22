import type { ObservationsRectified } from "#src/domain/observation-ledger/origin"
import { RECTIFY_ATTEMPTS } from "./constants.ts"
import { rectifiedOrigins, settledObservation } from "./rectify.ts"
import type { SavedNote, SessionRecord } from "./types.ts"
import { usersBetween } from "./user-messages.ts"

function sameNote(left: SavedNote, right: SavedNote): boolean {
  return left.vault === right.vault && left.path === right.path
}

export function pendingWrittenNotes(records: SessionRecord[], observationIds: string[]): SavedNote[] {
  const listed: SavedNote[] = []
  for (const record of records) {
    if (record.kind === "consolidation-meta" && record.data.notes) listed.push(...record.data.notes)
  }
  const owed: SavedNote[] = []
  for (const record of records) {
    if (record.kind !== "note-written") continue
    if (!record.data.observationIds.some((id) => observationIds.includes(id))) continue
    const note = { vault: record.data.vault, path: record.data.path }
    if (listed.some((other) => sameNote(other, note)) || owed.some((other) => sameNote(other, note))) continue
    owed.push(note)
  }
  return owed
}

function failuresOf(records: SessionRecord[], recordId: string): number {
  return records.filter((record) => record.kind === "rectify-failed" && record.data.recordId === recordId).length
}

export function exhaustedRectifications(records: SessionRecord[]): ObservationsRectified[] {
  const origins = rectifiedOrigins(records)
  const closed: ObservationsRectified[] = []
  for (const record of records) {
    if (record.kind !== "observations" || failuresOf(records, record.id) < RECTIFY_ATTEMPTS) continue
    const { fromId, coversUpToId } = record.data
    const from = records.findIndex((candidate) => candidate.id === fromId)
    const to = records.findIndex((candidate) => candidate.id === coversUpToId)
    if (from < 0 || to < from) continue
    const open = record.data.observations.filter(
      (observation) => settledObservation(record.id, observation, origins).origin === "unverified",
    )
    if (open.length === 0) continue
    closed.push({
      recordId: record.id,
      fromId,
      coversUpToId,
      userEntryIds: usersBetween(records, from, to).map((message) => message.id),
      observations: open.map((observation) => ({ id: observation.id, origin: "unconfirmed" })),
    })
  }
  return closed
}
