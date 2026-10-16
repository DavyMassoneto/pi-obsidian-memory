import type { SessionEntry, SessionMessageEntry } from "@earendil-works/pi-coding-agent"
import { vi } from "vitest"

import type { AddedDetails, RegistryMessage } from "#src/pi"
import { fakePiContext } from "./pi-context.ts"

const STAMP = "2026-10-20T10:00:00.000Z"

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

export function cursorEntry(id: string, lastEntryId: string): SessionEntry {
  return {
    type: "custom",
    id,
    parentId: null,
    timestamp: STAMP,
    customType: "obsidian-memory-capture",
    data: { lastEntryId },
  }
}

export function contextReplying(reply: RegistryMessage | null) {
  const { context } = fakePiContext("work", { available: [{ provider: "test-chat", id: "selected-chat" }] })
  const complete = vi.fn(async () => {
    if (!reply) throw new Error("unexpected")
    return reply
  })
  return { context: { ...context, modelRegistry: { ...context.modelRegistry, complete } }, complete }
}
