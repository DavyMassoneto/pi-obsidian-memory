import { expect, test } from "vitest"

import { RELEVANT_MESSAGE_TYPE, recordsOf } from "#src/pi"
import { localTimestamp, OBSERVATIONS_TYPE, RESUME_TYPE, textTokens } from "#src/usecases"
import {
  assistantEntryAt,
  bashEntry,
  branchSummaryEntry,
  compactionEntry,
  customEntry,
  customMessageEntry,
  ENTRY_STAMP,
  systemEntry,
  toolResultEntry,
  userEntryAt,
} from "#test-helpers"

const THIRTEEN_THIRTY_FIVE = new Date(2026, 9, 26, 13, 35, 0).getTime()
const THIRTEEN_FORTY = new Date(2026, 9, 26, 13, 40, 0).getTime()

test("user and assistant messages keep their text and tool calls, drop thinking, and carry pi's token estimate and local time", () => {
  const entries = [
    userEntryAt("u1", "Add a CSV export to the orders page.", THIRTEEN_THIRTY_FIVE),
    assistantEntryAt(
      "a1",
      [
        { type: "thinking", thinking: "The user wants a CSV export, so I should look at the orders page." },
        { type: "text", text: "I will read the page first." },
        { type: "toolCall", id: "call-1", name: "read", arguments: { path: "orders.ts" } },
      ],
      THIRTEEN_FORTY,
    ),
  ]

  expect(recordsOf(entries)).toEqual([
    {
      kind: "message",
      id: "u1",
      role: "user",
      toolName: null,
      localTime: "2026-10-26T13:35:00",
      tokens: 9,
      parts: [{ kind: "text", text: "Add a CSV export to the orders page." }],
      saved: null,
    },
    {
      kind: "message",
      id: "a1",
      role: "assistant",
      toolName: null,
      localTime: "2026-10-26T13:40:00",
      tokens: 29,
      parts: [
        { kind: "text", text: "I will read the page first." },
        { kind: "toolCall", text: 'read({"path":"orders.ts"})' },
      ],
      saved: null,
    },
  ])
})

test("tool results keep their tool name and a shell execution is its command then its output", () => {
  const records = recordsOf([toolResultEntry("t1", "memory_get", null), bashEntry("b1", "ls", "orders.ts")])

  expect(records).toMatchObject([
    { kind: "message", id: "t1", role: "toolResult", toolName: "memory_get", parts: [] },
    {
      kind: "message",
      id: "b1",
      role: "bashExecution",
      toolName: null,
      tokens: 3,
      parts: [{ kind: "text", text: "ls\norders.ts" }],
    },
  ])
})

test("a system message, our relevant-notes message and our resume message are not sources", () => {
  const entries = [
    systemEntry("s1", "You are a coding agent."),
    customMessageEntry("c1", RELEVANT_MESSAGE_TYPE, "Notes that may apply."),
    customMessageEntry("c2", RESUME_TYPE, "Continue where you stopped."),
  ]

  expect(recordsOf(entries)).toEqual([
    { kind: "other", id: "s1" },
    { kind: "other", id: "c1" },
    { kind: "other", id: "c2" },
  ])
})

test("a valid observations entry becomes an observations record, and an invalid one is ignored", () => {
  const data = {
    fromId: "u1",
    coversUpToId: "a1",
    observations: [{ id: "2026-10-26T13:35:00", content: "User asked for a CSV export.", tokens: 7 }],
  }

  expect(
    recordsOf([
      customEntry("o1", OBSERVATIONS_TYPE, data),
      customEntry("o2", OBSERVATIONS_TYPE, { fromId: "u1" }),
      customEntry("o3", "someone-else", data),
    ]),
  ).toEqual([
    { kind: "observations", id: "o1", data },
    { kind: "other", id: "o2" },
    { kind: "other", id: "o3" },
  ])
})

test("a compaction entry keeps its first kept entry id", () => {
  expect(recordsOf([compactionEntry("k1", "u2")])).toEqual([{ kind: "compaction", id: "k1", firstKeptEntryId: "u2" }])
})

test("other extensions' custom messages and branch summaries are sources with their text", () => {
  const records = recordsOf([
    customMessageEntry("c1", "other-extension", "A reminder from another extension."),
    branchSummaryEntry("bs1", "The branch tried a different export format."),
  ])

  expect(records).toEqual([
    {
      kind: "custom-message",
      id: "c1",
      customType: "other-extension",
      localTime: localTimestamp(Date.parse(ENTRY_STAMP)),
      tokens: textTokens("A reminder from another extension."),
      text: "A reminder from another extension.",
    },
    {
      kind: "branch-summary",
      id: "bs1",
      localTime: localTimestamp(Date.parse(ENTRY_STAMP)),
      tokens: textTokens("The branch tried a different export format."),
      text: "The branch tried a different export format.",
    },
  ])
})
