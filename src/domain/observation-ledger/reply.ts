import { Value } from "typebox/value"

import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { ObserverReplySchema } from "./schemas.ts"
import type { ObserverDraft } from "./types.ts"

function singleLine(content: string): string {
  return content.replace(/[\r\n]+/g, " ").trim()
}

function distinctDrafts(drafts: ObserverDraft[]): ObserverDraft[] {
  const seen = new Set<string>()
  const kept: ObserverDraft[] = []
  for (const draft of drafts) {
    const content = singleLine(draft.content)
    const key = `${draft.timestamp}\u241e${content}`
    if (content.length === 0 || seen.has(key)) continue
    seen.add(key)
    kept.push({ timestamp: draft.timestamp, content })
  }
  return kept
}

export function parseObserverReply(text: string): Succeeded<ObserverDraft[]> | Failed {
  try {
    const reply = JSON.parse(text)
    if (!Value.Check(ObserverReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(ObserverReplySchema, reply), "observer reply"),
      }
    }
    return { succeeded: true, output: distinctDrafts(reply.observations) }
  } catch {
    return { succeeded: false, problems: ["Invalid observer JSON"] }
  }
}
