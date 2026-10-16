import { maxTextChars } from "#src/domain/memory-agent"
import { maxTranscriptItems } from "./constants.ts"
import type { TranscriptMessage, TranscriptWindow } from "./types.ts"

export function transcriptWindows(messages: readonly TranscriptMessage[]): TranscriptWindow[] {
  const parts = messages.flatMap(splitMessage)
  const windows: TranscriptWindow[] = []
  for (let start = 0; start < parts.length; start += maxTranscriptItems) {
    windows.push(parts.slice(start, start + maxTranscriptItems))
  }
  return windows
}

function splitMessage(message: TranscriptMessage): TranscriptMessage[] {
  const parts: TranscriptMessage[] = []
  let start = 0
  while (start < message.text.length) {
    let end = Math.min(start + maxTextChars, message.text.length)
    if (end < message.text.length && isHighSurrogate(message.text.charCodeAt(end - 1))) end -= 1
    parts.push({ role: message.role, text: message.text.slice(start, end) })
    start = end
  }
  return parts
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}
