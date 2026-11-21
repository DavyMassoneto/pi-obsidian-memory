import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { Value } from "typebox/value"

import { type ObservationCommit, ObservationCommitSchema, type SourceEntry } from "#src/usecases"
import { OBSERVATION_ENTRY_TYPE } from "./constants.ts"
import type { SourceContent, SourceMessageEntry } from "./types.ts"

export function observationSources(branch: SessionEntry[]): SourceEntry[] {
  const sources: SourceEntry[] = []
  for (const entry of branch) {
    if (entry.type !== "message") continue
    const role = entry.message.role
    if (role !== "user" && role !== "assistant" && role !== "toolResult") continue
    const text = sourceText(entry)
    sources.push({
      id: entry.id,
      parentId: entry.parentId,
      text,
      tokenCount: Math.ceil(text.length / 4),
      canStartKeptRange: role !== "toolResult",
    })
  }
  return sources
}

export function observationCommits(branch: SessionEntry[]): ObservationCommit[] {
  const commits: ObservationCommit[] = []
  for (const entry of branch) {
    if (entry.type !== "custom" || entry.customType !== OBSERVATION_ENTRY_TYPE) continue
    if (Value.Check(ObservationCommitSchema, entry.data)) commits.push(entry.data)
  }
  return commits
}

function sourceText(entry: SourceMessageEntry): string {
  const message = entry.message
  if (message.role === "user" || message.role === "assistant")
    return `${entry.timestamp} ${message.role}: ${sourceContent(message.content)}`
  if (message.role === "toolResult")
    return `${entry.timestamp} tool ${message.toolName}: ${sourceContent(message.content)}`
  return ""
}

function sourceContent(content: SourceContent): string {
  if (typeof content === "string") return content
  return content
    .flatMap((part) => {
      if (part.type === "text") return [part.text]
      if (part.type === "toolCall") return [`Tool call ${part.name}: ${JSON.stringify(part.arguments)}`]
      if (part.type === "image") return ["[Image attachment]"]
      return []
    })
    .join("\n")
}
