import {
  type BranchSummaryRecord,
  type ChunkPlanRequest,
  type ChunkRange,
  type CompactionRecord,
  type CustomMessageRecord,
  type LedgerObservation,
  ledgerOf,
  type MessageRecord,
  type ObservationsRecord,
  type OtherRecord,
  type RecordPart,
  type SessionRecord,
} from "#src/domain"

const defaultLocalTime = "2026-10-26T13:35:00"

function messageRecord(
  id: string,
  role: MessageRecord["role"],
  toolName: string | null,
  parts: RecordPart[],
  tokens: number,
): MessageRecord {
  return { kind: "message", id, role, toolName, localTime: defaultLocalTime, tokens, parts, saved: null }
}

function textPart(text: string): RecordPart {
  return { kind: "text", text }
}

export function userRecord(id: string, text: string, tokens: number): MessageRecord {
  return messageRecord(id, "user", null, [textPart(text)], tokens)
}

export function assistantRecord(id: string, text: string, tokens: number): MessageRecord {
  return messageRecord(id, "assistant", null, [textPart(text)], tokens)
}

export function assistantPartsRecord(id: string, parts: RecordPart[], tokens: number): MessageRecord {
  return messageRecord(id, "assistant", null, parts, tokens)
}

export function toolCallPart(text: string): RecordPart {
  return { kind: "toolCall", text }
}

export function toolResultRecord(id: string, toolName: string, text: string, tokens: number): MessageRecord {
  return messageRecord(id, "toolResult", toolName, [textPart(text)], tokens)
}

export function shellRecord(id: string, text: string, tokens: number): MessageRecord {
  return messageRecord(id, "bashExecution", null, [textPart(text)], tokens)
}

export function customMessageRecord(id: string, customType: string, text: string, tokens: number): CustomMessageRecord {
  return { kind: "custom-message", id, customType, localTime: defaultLocalTime, tokens, text }
}

export function branchSummaryRecord(id: string, text: string, tokens: number): BranchSummaryRecord {
  return { kind: "branch-summary", id, localTime: null, tokens, text }
}

export function withLocalTime(record: MessageRecord, localTime: string | null): MessageRecord {
  return { ...record, localTime }
}

export function withoutTime(record: MessageRecord): MessageRecord {
  return { ...record, localTime: null }
}

export function observation(id: string, content: string): LedgerObservation {
  return { id, content, tokens: Math.ceil(content.length / 4) }
}

export function observationsRecord(
  id: string,
  fromId: string,
  coversUpToId: string,
  observations: LedgerObservation[],
): ObservationsRecord {
  return { kind: "observations", id, data: { fromId, coversUpToId, observations } }
}

export function compactionRecord(id: string, firstKeptEntryId: string): CompactionRecord {
  return { kind: "compaction", id, firstKeptEntryId }
}

export function otherRecord(id: string): OtherRecord {
  return { kind: "other", id }
}

export function chunkRange(fromId: string, coversUpToId: string): ChunkRange {
  return { fromId, coversUpToId }
}

export function turn(number: number, tokens: number): MessageRecord {
  if (number % 2 === 1) return userRecord(`r${number}`, `message ${number}`, tokens)
  return assistantRecord(`r${number}`, `message ${number}`, tokens)
}

export function conversation(count: number, tokens: number): SessionRecord[] {
  const records: SessionRecord[] = []
  for (let number = 1; number <= count; number++) records.push(turn(number, tokens))
  return records
}

export function chunkPlan(records: SessionRecord[], changes: Partial<ChunkPlanRequest>): ChunkPlanRequest {
  return {
    records,
    ledger: ledgerOf(records),
    inFlight: [],
    failed: [],
    attempted: [],
    chunkTokens: 25,
    concurrency: 4,
    nowMs: 0,
    until: null,
    ...changes,
  }
}
