import type { MaterialSource } from "#src/domain/observation-ledger/origin"
import { isSourceRecord } from "./records.ts"
import { recordText } from "./serialize.ts"
import type { ChunkRange, SessionRecord, SourceRecord } from "./types.ts"

function sourceText(record: SourceRecord): string {
  if (record.kind !== "message") return record.text
  const parts = record.parts.filter((part) => part.kind !== "omitted")
  return recordText({ ...record, parts })
}

export function materialSources(records: SessionRecord[], range: ChunkRange, maxChars: number): MaterialSource[] {
  const from = records.findIndex((record) => record.id === range.fromId)
  const to = records.findIndex((record) => record.id === range.coversUpToId)
  if (from < 0 || to < from) return []
  const sources: MaterialSource[] = []
  for (const record of records.slice(from, to + 1)) {
    if (!isSourceRecord(record)) continue
    let role: MaterialSource["role"]
    if (record.kind === "message") {
      if (record.role === "user") continue
      role = record.role
    } else {
      role = record.kind
    }
    const text = sourceText(record)
    if (text.length === 0) continue
    sources.push({ id: record.id, role, text: text.slice(0, maxChars), truncated: text.length > maxChars })
  }
  return sources
}
