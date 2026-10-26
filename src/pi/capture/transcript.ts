import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { Value } from "typebox/value"

import type { TextPart } from "#src/pi/completion"
import { MEMORY_ADD_TOOL_NAME } from "#src/pi/memory-add"
import type { ExplicitSave, TranscriptMessage } from "#src/usecases"
import { CURSOR_TYPE } from "./constants.ts"
import { AddedDetailsSchema, CursorSchema } from "./schemas.ts"
import type { ReviewableTranscript } from "./types.ts"

export function reviewableSince(entries: SessionEntry[]): ReviewableTranscript {
  const messages: TranscriptMessage[] = []
  const explicitSaves: ExplicitSave[] = []
  for (const entry of afterCursor(entries)) {
    if (entry.type !== "message") continue
    const { message } = entry
    if (message.role === "user") addText(messages, "user", message.content)
    else if (message.role === "assistant") addText(messages, "assistant", message.content)
    else if (message.role === "toolResult" && message.toolName === MEMORY_ADD_TOOL_NAME) {
      if (Value.Check(AddedDetailsSchema, message.details)) explicitSaves.push(message.details)
    }
  }
  const last = entries.at(-1)
  let lastEntryId: string | null = null
  if (last) lastEntryId = last.id
  return { messages, explicitSaves, lastEntryId }
}

function afterCursor(entries: SessionEntry[]): SessionEntry[] {
  const cursor = entries.findLast((entry) => entry.type === "custom" && entry.customType === CURSOR_TYPE)
  if (cursor?.type !== "custom") return entries
  const { data } = cursor
  if (!Value.Check(CursorSchema, data)) return entries
  const index = entries.findIndex((entry) => entry.id === data.lastEntryId)
  if (index === -1) return entries
  return entries.slice(index + 1)
}

function addText(
  messages: TranscriptMessage[],
  role: "user" | "assistant",
  content: string | readonly TextPart[],
): void {
  const text = textOf(content)
  if (text.trim() !== "") messages.push({ role, text })
}

function textOf(content: string | readonly TextPart[]): string {
  if (typeof content === "string") return content
  return content
    .flatMap((part) => {
      if (part.type === "text" && typeof part.text === "string") return [part.text]
      return []
    })
    .join("\n")
}
