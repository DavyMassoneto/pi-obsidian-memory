import { Value } from "typebox/value"

import type { UserPassage, UserWords, UserWordsCheck } from "#src/domain/observation-ledger/origin"
import { UserWordsReplySchema } from "#src/domain/observation-ledger/origin"
import { describeSchemaErrors } from "#src/domain/validation"
import type { Failed, Succeeded } from "#src/shared"
import { RECTIFY_ATTEMPTS, USER_WORDS_WHOLE_CHARS } from "./constants.ts"
import type { MessageRecord, SessionRecord } from "./types.ts"
import { containsUserQuote, spacedEvenly, userText } from "./user-messages.ts"

function observedUserMessages(records: SessionRecord[]): MessageRecord[] {
  const messages: MessageRecord[] = []
  for (const record of records) {
    if (record.kind !== "observations") continue
    const from = records.findIndex((candidate) => candidate.id === record.data.fromId)
    const to = records.findIndex((candidate) => candidate.id === record.data.coversUpToId)
    if (from < 0 || to < from) continue
    for (const candidate of records.slice(from, to + 1)) {
      if (candidate.kind === "message" && candidate.role === "user" && !messages.includes(candidate)) {
        messages.push(candidate)
      }
    }
  }
  return messages
}

function keptWhole(records: SessionRecord[], message: MessageRecord): boolean {
  if (userText(message).text.trim().length <= USER_WORDS_WHOLE_CHARS) return true
  const failures = records.filter(
    (record) => record.kind === "rectify-failed" && record.data.recordId === message.id,
  ).length
  return failures >= RECTIFY_ATTEMPTS
}

function openMessages(records: SessionRecord[], whole: boolean): MessageRecord[] {
  const done = new Set<string>()
  for (const record of records) if (record.kind === "user-words") done.add(record.data.entryId)
  return observedUserMessages(records).filter((message) => {
    if (done.has(message.id) || userText(message).text.trim().length === 0) return false
    return keptWhole(records, message) === whole
  })
}

export function userWordsChecks(records: SessionRecord[]): UserWordsCheck[] {
  return openMessages(records, false).map((message) => ({ entryId: message.id, text: userText(message).text }))
}

export function wholeUserWords(records: SessionRecord[]): UserWords[] {
  return openMessages(records, true).map((message) => ({
    entryId: message.id,
    passages: [{ kind: "message", quote: spacedEvenly(userText(message).text) }],
  }))
}

export function verifiedUserWords(check: UserWordsCheck, passages: UserPassage[]): UserWords {
  const kept: UserPassage[] = []
  for (const passage of passages) {
    if (!containsUserQuote(check.text, passage.quote)) continue
    if (kept.some((other) => containsUserQuote(other.quote, passage.quote))) continue
    kept.push({ kind: passage.kind, quote: spacedEvenly(passage.quote) })
  }
  return { entryId: check.entryId, passages: kept }
}

export function shortUserText(message: MessageRecord): string | null {
  const text = userText(message).text.trim()
  if (text.length === 0 || text.length > USER_WORDS_WHOLE_CHARS) return null
  return spacedEvenly(text)
}

export function parseUserWordsReply(text: string): Succeeded<UserPassage[]> | Failed {
  try {
    const reply = Value.Clean(UserWordsReplySchema, JSON.parse(text))
    if (!Value.Check(UserWordsReplySchema, reply)) {
      return {
        succeeded: false,
        problems: describeSchemaErrors(Value.Errors(UserWordsReplySchema, reply), "user words reply"),
      }
    }
    return { succeeded: true, output: reply.passages }
  } catch {
    return { succeeded: false, problems: ["Invalid user words JSON"] }
  }
}
