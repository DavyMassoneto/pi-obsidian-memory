import { CHARS_PER_TOKEN, NON_TEXT_OMITTED, UNKNOWN_MINUTE } from "./constants.ts"
import { isSourceRecord } from "./records.ts"
import type { ChunkRange, RecordPart, SessionRecord, SourceRecord } from "./types.ts"

function minuteOf(localTime: string | null): string {
  if (!localTime) return UNKNOWN_MINUTE
  return localTime.replace("T", " ").slice(0, 16)
}

function partText(part: RecordPart): string {
  if (part.kind === "toolCall") return `[${part.text}]`
  if (part.kind === "omitted") return NON_TEXT_OMITTED
  return part.text
}

function labelOf(record: SourceRecord): string {
  if (record.kind === "custom-message") return `Custom (${record.customType})`
  if (record.kind === "branch-summary") return "Branch summary"
  if (record.role === "user") return "User"
  if (record.role === "assistant") return "Assistant"
  if (record.role === "bashExecution") return "Shell command"
  if (record.toolName) return `Tool result for ${record.toolName}`
  return "Tool result"
}

function bodyOf(record: SourceRecord): string {
  if (record.kind !== "message") return record.text
  return record.parts
    .map(partText)
    .filter((text) => text.length > 0)
    .join("\n")
}

function limited(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body
  return `${body.slice(0, maxChars)}\n[… ${body.length - maxChars} characters left out]`
}

function blockOf(record: SourceRecord, maxChars: number): string | null {
  const body = limited(bodyOf(record), maxChars)
  if (body.length === 0) return null
  return `[Source entry id: ${record.id}]\n[${labelOf(record)} @ ${minuteOf(record.localTime)}]: ${body}`
}

export function chunkText(records: SessionRecord[], range: ChunkRange, maxBlockTokens: number): string {
  const from = records.findIndex((record) => record.id === range.fromId)
  const to = records.findIndex((record) => record.id === range.coversUpToId)
  const maxChars = maxBlockTokens * CHARS_PER_TOKEN
  const blocks: string[] = []
  for (const record of records.slice(from, to + 1)) {
    if (!isSourceRecord(record)) continue
    const block = blockOf(record, maxChars)
    if (block) blocks.push(block)
  }
  return blocks.join("\n\n")
}
