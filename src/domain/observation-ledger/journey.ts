import { Value } from "typebox/value"

import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { activeObservations } from "./pool.ts"
import { JourneyReplySchema } from "./schemas.ts"
import type { Ledger, LedgerObservation, ObservationsConsolidated } from "./types.ts"

export function parseJourneyReply(text: string): Succeeded<string> | Failed {
  try {
    const reply = JSON.parse(text)
    if (!Value.Check(JourneyReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(JourneyReplySchema, reply), "journey reply"),
      }
    }
    return { succeeded: true, output: reply.journey }
  } catch {
    return { succeeded: false, problems: ["Invalid journey JSON"] }
  }
}

export function consolidatedData(
  promoted: LedgerObservation[],
  ledger: Ledger,
  journey: string,
): ObservationsConsolidated | null {
  const active = new Set(activeObservations(ledger).map((observation) => observation.id))
  const observationIds = promoted.map((observation) => observation.id).filter((id) => active.has(id))
  if (observationIds.length === 0) return null
  return { observationIds, journey }
}
