import type { UserMessageText } from "#src/domain/observation-ledger/origin"
import { NON_TEXT_OMITTED, NOT_LETTER_OR_DIGIT } from "./constants.ts"
import type { MessageRecord, SessionRecord } from "./types.ts"

export function spacedEvenly(text: string): string {
  return text.replace(/\s+/g, " ").trim()
}

export function containsUserQuote(source: string, quote: string): boolean {
  const foldedQuote = spacedEvenly(quote)
  return foldedQuote.length > 0 && spacedEvenly(source).includes(foldedQuote)
}

export function comparable(text: string): string {
  return text.normalize("NFD").replace(NOT_LETTER_OR_DIGIT, "").toLowerCase()
}

export function containsWords(text: string, quote: string): boolean {
  const words = comparable(quote)
  return words.length > 0 && comparable(text).includes(words)
}

export function userText(record: MessageRecord): UserMessageText {
  const lines: string[] = []
  for (const part of record.parts) {
    if (part.kind === "omitted") lines.push(NON_TEXT_OMITTED)
    else if (part.text.length > 0) lines.push(part.text)
  }
  return { id: record.id, text: lines.join("\n") }
}

export function usersBetween(records: SessionRecord[], from: number, to: number): UserMessageText[] {
  const users: UserMessageText[] = []
  for (const record of records.slice(from, to + 1)) {
    if (record.kind === "message" && record.role === "user") users.push(userText(record))
  }
  return users
}

export function earlierThatFit(earlier: UserMessageText[], maxChars: number): UserMessageText[] {
  const kept: UserMessageText[] = []
  let chars = 0
  for (const message of [...earlier].reverse()) {
    chars += message.text.length
    if (chars > maxChars) break
    kept.unshift(message)
  }
  return kept
}
