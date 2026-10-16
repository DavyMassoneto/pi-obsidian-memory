import { expect, test } from "vitest"

import { reviewableSince } from "#src/pi"
import { assistantEntry, cursorEntry, toolResultEntry, userEntry } from "#test-helpers"

test("user and assistant text is the transcript, in order, with only the text of each part", () => {
  const transcript = reviewableSince([
    userEntry("1", "I always use pnpm"),
    assistantEntry("2", [
      { type: "thinking", thinking: "hidden reasoning" },
      { type: "text", text: "Noted." },
      { type: "toolCall", id: "c", name: "read", arguments: {} },
      { type: "text", text: "Anything else?" },
    ]),
  ])

  expect(transcript.messages).toEqual([
    { role: "user", text: "I always use pnpm" },
    { role: "assistant", text: "Noted.\nAnything else?" },
  ])
  expect(transcript.lastEntryId).toBe("2")
})

test("tool results, thinking-only turns and empty text are left out", () => {
  const transcript = reviewableSince([
    userEntry("1", "   "),
    assistantEntry("2", [{ type: "thinking", thinking: "only thoughts" }]),
    toolResultEntry("3", "read", null),
  ])

  expect(transcript.messages).toEqual([])
})

test("a memory_add result gives an explicit save, and other tools' details do not", () => {
  const transcript = reviewableSince([
    toolResultEntry("1", "memory_add", { vault: "project", path: "tools/Use pnpm.md" }),
    toolResultEntry("2", "other_tool", { vault: "global", path: "x.md" }),
    toolResultEntry("3", "memory_add", null),
  ])

  expect(transcript.explicitSaves).toEqual([{ vault: "project", path: "tools/Use pnpm.md" }])
})

test("only what follows the saved cursor is reviewed, so a resumed session is not reviewed again", () => {
  const transcript = reviewableSince([
    userEntry("1", "old message"),
    assistantEntry("2", [{ type: "text", text: "old answer" }]),
    cursorEntry("3", "2"),
    userEntry("4", "new message"),
  ])

  expect(transcript.messages).toEqual([{ role: "user", text: "new message" }])
  expect(transcript.lastEntryId).toBe("4")
})

test("a cursor that points outside this branch reviews the whole branch", () => {
  const transcript = reviewableSince([cursorEntry("1", "missing"), userEntry("2", "a message")])

  expect(transcript.messages).toEqual([{ role: "user", text: "a message" }])
})

test("an empty branch has nothing to review and no last entry", () => {
  expect(reviewableSince([])).toEqual({ messages: [], explicitSaves: [], lastEntryId: null })
})
