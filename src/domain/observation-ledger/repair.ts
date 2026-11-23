import { Value } from "typebox/value"

import type {
  AttributionCheck,
  CheckedObservation,
  MaterialSource,
  RectifiedObservation,
  Repair,
  RepairCheck,
} from "#src/domain/observation-ledger/origin"
import { RepairReplySchema } from "#src/domain/observation-ledger/origin"
import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { rectificationKey, rectifiedOrigins } from "./rectify.ts"
import type { SessionRecord } from "./types.ts"
import { containsUserQuote as containsSourceQuote, spacedEvenly } from "./user-messages.ts"

export function falseAttributions(check: AttributionCheck, observations: RectifiedObservation[]): CheckedObservation[] {
  const falseIds = observations
    .filter((item) => item.origin === "material" && typeof item.content !== "string")
    .map((item) => item.id)
  return check.observations.filter((observation) => falseIds.includes(observation.id))
}

function repairedOne(item: RectifiedObservation, repairs: Repair[], sources: MaterialSource[]): RectifiedObservation {
  const repair = repairs.find((candidate) => candidate.id === item.id)
  if (item.origin !== "material" || typeof item.content === "string" || !repair) return item
  const { sourceId, quote } = repair
  if (typeof sourceId !== "string" || typeof quote !== "string") return item
  const source = sources.find((candidate) => candidate.id === sourceId)
  if (!source || !containsSourceQuote(source.text, quote)) return item
  const content = repair.content.trim()
  if (content.length === 0 || /[\r\n]/.test(content)) return item
  return { id: item.id, origin: "material", content, sourceId, quote: spacedEvenly(quote) }
}

export function repairedObservations(
  sources: MaterialSource[],
  observations: RectifiedObservation[],
  repairs: Repair[],
): RectifiedObservation[] {
  return observations.map((item) => repairedOne(item, repairs, sources))
}

export function repairChecks(records: SessionRecord[]): RepairCheck[] {
  const origins = rectifiedOrigins(records)
  const checks: RepairCheck[] = []
  for (const record of records) {
    if (record.kind !== "observations") continue
    const pending = record.data.observations.filter((observation) => {
      const rectified = origins.get(rectificationKey(record.id, observation.id))
      return rectified?.origin === "material" && typeof rectified.content !== "string"
    })
    if (pending.length === 0) continue
    const { fromId, coversUpToId } = record.data
    checks.push({
      check: {
        recordId: record.id,
        fromId,
        coversUpToId,
        userEntryIds: [],
        userMessages: [],
        materialSources: [],
        observations: pending.map((observation) => ({ id: observation.id, content: observation.content })),
      },
      origins: pending.map((observation) => ({ id: observation.id, origin: "material" })),
    })
  }
  return checks
}

export function parseRepairReply(text: string): Succeeded<Repair[]> | Failed {
  try {
    const reply = JSON.parse(text)
    if (!Value.Check(RepairReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(RepairReplySchema, reply), "repair reply"),
      }
    }
    return { succeeded: true, output: reply.repairs }
  } catch {
    return { succeeded: false, problems: ["Invalid repair JSON"] }
  }
}
