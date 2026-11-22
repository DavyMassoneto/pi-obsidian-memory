import { Value } from "typebox/value"

import type {
  AttributionCheck,
  CheckedObservation,
  RectifiedObservation,
  Repair,
  RepairCheck,
} from "#src/domain/observation-ledger/origin"
import { RepairReplySchema } from "#src/domain/observation-ledger/origin"
import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { isSourceRecord } from "./records.ts"
import { rectificationKey, rectifiedOrigins } from "./rectify.ts"
import { recordText } from "./serialize.ts"
import type { SessionRecord, SourceRecord } from "./types.ts"
import { containsWords, spacedEvenly } from "./user-messages.ts"

export function falseAttributions(check: AttributionCheck, observations: RectifiedObservation[]): CheckedObservation[] {
  const falseIds = observations
    .filter((item) => item.origin === "material" && typeof item.content !== "string")
    .map((item) => item.id)
  return check.observations.filter((observation) => falseIds.includes(observation.id))
}

function readSources(records: SessionRecord[], check: AttributionCheck): SourceRecord[] {
  const from = records.findIndex((record) => record.id === check.fromId)
  const to = records.findIndex((record) => record.id === check.coversUpToId)
  const sources: SourceRecord[] = []
  for (const record of records.slice(from, to + 1)) {
    if (!isSourceRecord(record)) continue
    if (record.kind === "message" && record.role === "user") continue
    sources.push(record)
  }
  return sources
}

function repairedOne(item: RectifiedObservation, repairs: Repair[], sources: SourceRecord[]): RectifiedObservation {
  const repair = repairs.find((candidate) => candidate.id === item.id)
  if (item.origin !== "material" || typeof item.content === "string" || !repair) return item
  const { sourceId, quote } = repair
  if (typeof sourceId !== "string" || typeof quote !== "string") return item
  const source = sources.find((candidate) => candidate.id === sourceId)
  if (!source || !containsWords(recordText(source), quote)) return item
  if (/[\r\n]/.test(repair.content.trim())) return item
  return { id: item.id, origin: "material", content: repair.content.trim(), sourceId, quote: spacedEvenly(quote) }
}

export function repairedObservations(
  records: SessionRecord[],
  check: AttributionCheck,
  observations: RectifiedObservation[],
  repairs: Repair[],
): RectifiedObservation[] {
  const sources = readSources(records, check)
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
