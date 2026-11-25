import { Value } from "typebox/value"

import type { ConsolidationMeta } from "#src/domain/observation-ledger/origin"
import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { ECHOED_JOURNEY_INPUT_FIELDS } from "./constants.ts"
import { activeObservations } from "./pool.ts"
import { JourneyReplySchema, JourneyReplyShapeSchema } from "./schemas.ts"
import type { ConsolidationWrite, JourneyReply, Ledger, LedgerObservation, SavedNote, WorkStateItem } from "./types.ts"

export function parseJourneyReply(text: string): Succeeded<JourneyReply> | Failed {
  try {
    const reply = JSON.parse(text)
    if (Value.Check(JourneyReplyShapeSchema, reply)) {
      for (const field of ECHOED_JOURNEY_INPUT_FIELDS) Reflect.deleteProperty(reply, field)
    }
    if (!Value.Check(JourneyReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(JourneyReplySchema, reply), "journey reply"),
      }
    }
    return { succeeded: true, output: reply }
  } catch {
    return { succeeded: false, problems: ["Invalid journey JSON"] }
  }
}

export function consolidatedData(
  promoted: LedgerObservation[],
  ledger: Ledger,
  journey: string,
  told: LedgerObservation[],
  notes: SavedNote[],
  workState?: WorkStateItem[],
): ConsolidationWrite {
  const active = new Set(activeObservations(ledger).map((observation) => observation.id))
  const observationIds = promoted.map((observation) => observation.id).filter((id) => active.has(id))
  const materialIds = told
    .filter((observation) => observation.origin === "material")
    .map((observation) => observation.id)
  if (observationIds.length === 0 && materialIds.length === 0) return { consolidated: null, meta: null }
  const meta: ConsolidationMeta = { observationIds }
  if (workState) meta.workState = workState
  if (materialIds.length > 0) meta.materialIds = materialIds
  if (notes.length > 0) meta.notes = notes
  if (observationIds.length === 0) return { consolidated: null, meta: { ...meta, journey } }
  if (!workState && materialIds.length === 0 && notes.length === 0)
    return { consolidated: { observationIds, journey }, meta: null }
  return { consolidated: { observationIds, journey }, meta }
}
