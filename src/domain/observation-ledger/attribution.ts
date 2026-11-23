import { Value } from "typebox/value"

import type {
  AttributionCheck,
  AttributionVerdict,
  CheckedObservation,
  ObservationsRectified,
  RectifiedObservation,
  UserMessageText,
} from "#src/domain/observation-ledger/origin"
import { AttributionReplySchema } from "#src/domain/observation-ledger/origin"
import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { materialSources } from "./material-sources.ts"
import { rectifiedOrigins, settledObservation } from "./rectify.ts"
import type { ObservationsRecord, SessionRecord } from "./types.ts"
import { containsUserQuote, earlierThatFit, spacedEvenly, usersBetween } from "./user-messages.ts"

function checkOf(
  records: SessionRecord[],
  record: ObservationsRecord,
  maxChars: number,
  observations: AttributionCheck["observations"],
): AttributionCheck | null {
  const { fromId, coversUpToId } = record.data
  const from = records.findIndex((candidate) => candidate.id === fromId)
  const to = records.findIndex((candidate) => candidate.id === coversUpToId)
  if (from < 0 || to < from) return null
  const inRange = usersBetween(records, from, to)
  const earlier = earlierThatFit(usersBetween(records, 0, from - 1), maxChars)
  return {
    recordId: record.id,
    fromId,
    coversUpToId,
    userEntryIds: inRange.map((message) => message.id),
    userMessages: [...earlier, ...inRange],
    materialSources: materialSources(records, record.data, maxChars),
    observations,
  }
}

export function attributionChecks(records: SessionRecord[], maxChars: number): AttributionCheck[] {
  const origins = rectifiedOrigins(records)
  const checks: AttributionCheck[] = []
  for (const record of records) {
    if (record.kind !== "observations") continue
    const unsettled = record.data.observations
      .filter((observation) => settledObservation(record.id, observation, origins).origin === "unverified")
      .map((observation) => ({ id: observation.id, content: observation.content }))
    if (unsettled.length === 0) continue
    const check = checkOf(records, record, maxChars, unsettled)
    if (check) checks.push(check)
  }
  return checks
}

function supportedOrigin(id: string, verdict: AttributionVerdict, check: AttributionCheck): RectifiedObservation {
  const { supportedBy, quote } = verdict
  if (typeof supportedBy !== "string" || typeof quote !== "string") return { id, origin: "unconfirmed" }
  const message = check.userMessages.find((candidate) => candidate.id === supportedBy)
  if (!message || !containsUserQuote(message.text, quote)) {
    return { id, origin: "unconfirmed" }
  }
  const evidence = { id, supportedBy, quote: spacedEvenly(quote) }
  if (verdict.partial) return { ...evidence, origin: "partial", quotes: wordsWritten(message, verdict) }
  if (check.userEntryIds.includes(supportedBy)) return { ...evidence, origin: "user" }
  return { ...evidence, origin: "restated" }
}

function hasUserEvidence(verdict: AttributionVerdict): boolean {
  if (verdict.partial || typeof verdict.supportedBy === "string" || typeof verdict.quote === "string") return true
  return Array.isArray(verdict.moreQuotes) && verdict.moreQuotes.length > 0
}

function verdictOrigin(
  observation: CheckedObservation,
  verdicts: AttributionVerdict[],
  check: AttributionCheck,
): RectifiedObservation {
  const { id } = observation
  const matching = verdicts.filter((candidate) => candidate.id === id)
  const [verdict] = matching
  if (!verdict || matching.length !== 1 || verdict.actor === "unknown") return { id, origin: "unconfirmed" }
  if (hasUserEvidence(verdict)) {
    if (verdict.actor === "user") return supportedOrigin(id, verdict, check)
    return { id, origin: "unconfirmed" }
  }
  if (verdict.actor === "none") return { id, origin: "mention" }
  return { id, origin: "material" }
}

function wordsWritten(message: UserMessageText, verdict: AttributionVerdict): string[] {
  const quotes: string[] = []
  if (typeof verdict.quote === "string") quotes.push(verdict.quote)
  if (verdict.moreQuotes) quotes.push(...verdict.moreQuotes)
  return [...new Set(quotes.filter((quote) => containsUserQuote(message.text, quote)).map(spacedEvenly))]
}

export function closedOrigins(observations: RectifiedObservation[]): RectifiedObservation[] {
  return observations.map((item) => {
    if (item.origin !== "material" || typeof item.content === "string") return item
    return { id: item.id, origin: "unconfirmed" }
  })
}

export function verifiedOrigins(
  check: AttributionCheck,
  verdicts: AttributionVerdict[],
): Succeeded<RectifiedObservation[]> | Failed {
  const answered = check.observations.some((observation) => verdicts.some((verdict) => verdict.id === observation.id))
  if (!answered) {
    return { succeeded: false, problems: check.observations.map((observation) => `No verdict for ${observation.id}`) }
  }
  return {
    succeeded: true,
    output: check.observations.map((observation) => verdictOrigin(observation, verdicts, check)),
  }
}

export function unconfirmedCheck(
  check: AttributionCheck,
  observations: RectifiedObservation[],
): AttributionCheck | null {
  const open = observations
    .filter((item) => item.origin === "unconfirmed" && typeof item.supportedBy !== "string")
    .map((item) => item.id)
  if (open.length === 0) return null
  return { ...check, observations: check.observations.filter((observation) => open.includes(observation.id)) }
}

export function mergedOrigins(first: RectifiedObservation[], second: RectifiedObservation[]): RectifiedObservation[] {
  return first.map((item) => {
    const again = second.find((candidate) => candidate.id === item.id)
    if (item.origin === "unconfirmed" && again) return again
    return item
  })
}

export function rectifiedData(check: AttributionCheck, observations: RectifiedObservation[]): ObservationsRectified {
  const { recordId, fromId, coversUpToId, userEntryIds } = check
  return { recordId, fromId, coversUpToId, userEntryIds, observations }
}

export function parseAttributionReply(text: string): Succeeded<AttributionVerdict[]> | Failed {
  try {
    const reply = Value.Clean(AttributionReplySchema, JSON.parse(text))
    if (!Value.Check(AttributionReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(AttributionReplySchema, reply), "attribution reply"),
      }
    }
    return { succeeded: true, output: reply.verdicts }
  } catch {
    return { succeeded: false, problems: ["Invalid attribution JSON"] }
  }
}
