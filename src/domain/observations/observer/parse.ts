import { Value } from "typebox/value"

import { ObserverReplySchema } from "./schemas.ts"
import type { ObserverReplyResult } from "./types.ts"

export function parseObserverReply(text: string, sourceIds: string[]): ObserverReplyResult {
  try {
    const reply = JSON.parse(text)
    if (!Value.Check(ObserverReplySchema, reply)) return { succeeded: false, problems: ["Invalid observer reply"] }
    const sources = new Set(sourceIds)
    const valid = reply.observations.every((observation) => observation.sourceEntryIds.every((id) => sources.has(id)))
    if (!valid) return { succeeded: false, problems: ["Observation refers to an entry outside the observed slice"] }
    return { succeeded: true, output: reply.observations }
  } catch {
    return { succeeded: false, problems: ["Invalid observer JSON"] }
  }
}
