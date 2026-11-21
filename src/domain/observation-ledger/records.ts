import type { SessionRecord, SourceRecord } from "./types.ts"

export function isSourceRecord(record: SessionRecord): record is SourceRecord {
  return record.kind === "message" || record.kind === "custom-message" || record.kind === "branch-summary"
}

export function isCutPoint(record: SessionRecord): boolean {
  if (record.kind === "message") return record.role === "user" || record.role === "assistant"
  return record.kind === "custom-message" || record.kind === "branch-summary"
}
