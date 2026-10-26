import type { SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent"

import type { AddedDetails, RegistryMessage } from "#src/pi"
import type { ObservationsRecorded } from "#src/usecases"

const STAMP = "2026-10-20T10:00:00.000Z"

export const ENTRY_STAMP = STAMP

export function userEntry(id: string, text: string): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: STAMP,
    message: { role: "user", content: text, timestamp: 1 },
  }
}

export function assistantMessage(
  parts: RegistryMessage["content"],
  stopReason: RegistryMessage["stopReason"],
): RegistryMessage {
  const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost }
  return {
    role: "assistant",
    content: parts,
    api: "test",
    provider: "test",
    model: "m",
    usage,
    stopReason,
    timestamp: 1,
  }
}

export function assistantEntry(id: string, parts: RegistryMessage["content"]): SessionEntry {
  return { type: "message", id, parentId: null, timestamp: STAMP, message: assistantMessage(parts, "stop") }
}

export function toolResultEntry(id: string, toolName: string, saved: AddedDetails | null): SessionEntry {
  const base = { role: "toolResult" as const, toolCallId: id, toolName, content: [], isError: false, timestamp: 1 }
  let message: SessionMessageEntry["message"] = base
  if (saved) message = { ...base, details: { vault: saved.vault, path: saved.path } }
  return { type: "message", id, parentId: null, timestamp: STAMP, message }
}

export function userEntryAt(id: string, text: string, timestamp: number): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: STAMP,
    message: { role: "user", content: text, timestamp },
  }
}

export function assistantEntryAt(id: string, parts: RegistryMessage["content"], timestamp: number): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: STAMP,
    message: { ...assistantMessage(parts, "stop"), timestamp },
  }
}

export function systemEntry(id: string, text: string): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: STAMP,
    message: { role: "system", content: text, timestamp: 1 },
  }
}

function bashEntryOf(id: string, command: string, output: string, excludeFromContext: boolean): SessionEntry {
  const message: SessionMessageEntry["message"] = {
    role: "bashExecution",
    command,
    output,
    exitCode: 0,
    cancelled: false,
    truncated: false,
    timestamp: 1,
    excludeFromContext,
  }
  return { type: "message", id, parentId: null, timestamp: STAMP, message }
}

export function bashEntry(id: string, command: string, output: string): SessionEntry {
  return bashEntryOf(id, command, output, false)
}

export function hiddenBashEntry(id: string, command: string, output: string): SessionEntry {
  return bashEntryOf(id, command, output, true)
}

export function customEntry(id: string, customType: string, data: Partial<ObservationsRecorded>): SessionEntry {
  return { type: "custom", id, parentId: null, timestamp: STAMP, customType, data }
}

export function customMessageEntry(id: string, customType: string, text: string): SessionEntry {
  return {
    type: "custom_message",
    id,
    parentId: null,
    timestamp: STAMP,
    customType,
    content: text,
    display: false,
  }
}

export function compactionEntry(id: string, firstKeptEntryId: string): SessionEntry {
  return {
    type: "compaction",
    id,
    parentId: null,
    timestamp: STAMP,
    summary: "summary",
    firstKeptEntryId,
    tokensBefore: 100,
  }
}

export function branchSummaryEntry(id: string, summary: string): SessionEntry {
  return { type: "branch_summary", id, parentId: null, timestamp: STAMP, fromId: "root", summary }
}
