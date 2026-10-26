import {
  type BranchSummaryEntry,
  type CompactionEntry,
  type CustomEntry,
  type CustomMessageEntry,
  estimateTokens,
  type SessionEntry,
  type SessionMessageEntry,
} from "@earendil-works/pi-coding-agent"
import { Value } from "typebox/value"

import type { RegistryMessage } from "#src/pi/context"
import { RELEVANT_MESSAGE_TYPE } from "#src/pi/relevant-memory"
import {
  localTimestamp,
  type MessageRecord,
  OBSERVATIONS_TYPE,
  ObservationsRecordedSchema,
  RESUME_TYPE,
  type RecordPart,
  type SessionRecord,
  textTokens,
} from "#src/usecases"

function otherRecord(entry: SessionEntry): SessionRecord {
  return { kind: "other", id: entry.id }
}

function contentParts(content: CustomMessageEntry["content"]): RecordPart[] {
  if (typeof content === "string") return [{ kind: "text", text: content }]
  return content.map((block): RecordPart => {
    if (block.type === "text") return { kind: "text", text: block.text }
    return { kind: "omitted", text: "" }
  })
}

function textOf(content: CustomMessageEntry["content"]): string {
  return contentParts(content)
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join("\n")
}

function assistantParts(content: RegistryMessage["content"]): RecordPart[] {
  return content.flatMap((block): RecordPart[] => {
    if (block.type === "text") return [{ kind: "text", text: block.text }]
    if (block.type === "toolCall") {
      return [{ kind: "toolCall", text: `${block.name}(${JSON.stringify(block.arguments)})` }]
    }
    return []
  })
}

function sourceMessage(
  entry: SessionMessageEntry,
  role: MessageRecord["role"],
  toolName: string | null,
  parts: RecordPart[],
): MessageRecord {
  return {
    kind: "message",
    id: entry.id,
    role,
    toolName,
    localTime: localTimestamp(entry.message.timestamp),
    tokens: estimateTokens(entry.message),
    parts,
    saved: null,
  }
}

function messageRecordOf(entry: SessionMessageEntry): SessionRecord {
  const { message } = entry
  if (message.role === "user") return sourceMessage(entry, "user", null, contentParts(message.content))
  if (message.role === "assistant") return sourceMessage(entry, "assistant", null, assistantParts(message.content))
  if (message.role === "toolResult") {
    return sourceMessage(entry, "toolResult", message.toolName, contentParts(message.content))
  }
  if (message.role === "bashExecution") {
    if (message.excludeFromContext) return otherRecord(entry)
    const text = `${message.command}\n${message.output}`
    return sourceMessage(entry, "bashExecution", null, [{ kind: "text", text }])
  }
  return otherRecord(entry)
}

function customMessageRecordOf(entry: CustomMessageEntry): SessionRecord {
  if (entry.customType === RELEVANT_MESSAGE_TYPE || entry.customType === RESUME_TYPE) return otherRecord(entry)
  const text = textOf(entry.content)
  return {
    kind: "custom-message",
    id: entry.id,
    customType: entry.customType,
    localTime: localTimestamp(Date.parse(entry.timestamp)),
    tokens: textTokens(text),
    text,
  }
}

function branchSummaryRecordOf(entry: BranchSummaryEntry): SessionRecord {
  return {
    kind: "branch-summary",
    id: entry.id,
    localTime: localTimestamp(Date.parse(entry.timestamp)),
    tokens: textTokens(entry.summary),
    text: entry.summary,
  }
}

function customRecordOf(entry: CustomEntry): SessionRecord {
  if (entry.customType === OBSERVATIONS_TYPE && Value.Check(ObservationsRecordedSchema, entry.data)) {
    return { kind: "observations", id: entry.id, data: entry.data }
  }
  return otherRecord(entry)
}

function compactionRecordOf(entry: CompactionEntry): SessionRecord {
  return { kind: "compaction", id: entry.id, firstKeptEntryId: entry.firstKeptEntryId }
}

function recordOf(entry: SessionEntry): SessionRecord {
  if (entry.type === "message") return messageRecordOf(entry)
  if (entry.type === "custom_message") return customMessageRecordOf(entry)
  if (entry.type === "branch_summary") return branchSummaryRecordOf(entry)
  if (entry.type === "custom") return customRecordOf(entry)
  if (entry.type === "compaction") return compactionRecordOf(entry)
  return otherRecord(entry)
}

export function recordsOf(entries: SessionEntry[]): SessionRecord[] {
  return entries.map(recordOf)
}
