import type { RectifiedObservation, RectifiedOrigins } from "#src/domain/observation-ledger/origin"
import { RECTIFICATION_KEY_SEPARATOR } from "./constants.ts"
import { textTokens } from "./tokens.ts"
import type { LedgerObservation, SessionRecord, StoredObservation } from "./types.ts"

export function rectificationKey(recordId: string, observationId: string): string {
  return `${recordId}${RECTIFICATION_KEY_SEPARATOR}${observationId}`
}

export function rectifiedOrigins(records: SessionRecord[]): RectifiedOrigins {
  const origins = new Map<string, RectifiedObservation>()
  for (const record of records) {
    if (record.kind !== "rectified") continue
    for (const observation of record.data.observations) {
      origins.set(rectificationKey(record.data.recordId, observation.id), observation)
    }
  }
  return origins
}

function rectifiedVersion(observation: StoredObservation, rectified: RectifiedObservation): LedgerObservation {
  const { id, content, tokens } = observation
  const { origin } = rectified
  if (origin === "unconfirmed") return { id, content, tokens, origin }
  if (origin === "partial" && typeof rectified.supportedBy === "string" && rectified.quotes) {
    return { id, content, tokens, origin, sources: [rectified.supportedBy], userWords: rectified.quotes }
  }
  if (typeof rectified.supportedBy === "string") {
    return { id, content, tokens, origin, sources: [rectified.supportedBy] }
  }
  if (typeof rectified.content === "string" && typeof rectified.sourceId === "string") {
    return {
      id,
      content: rectified.content,
      tokens: textTokens(rectified.content),
      origin,
      sources: [rectified.sourceId],
    }
  }
  return { id, content, tokens, origin }
}

export function settledObservation(
  recordId: string,
  observation: StoredObservation,
  origins: RectifiedOrigins,
): LedgerObservation {
  const rectified = origins.get(rectificationKey(recordId, observation.id))
  if (rectified) return rectifiedVersion(observation, rectified)
  return { ...observation, origin: "unverified" }
}
