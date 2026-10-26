import { describe, expect, it } from "vitest"

import { chunkText } from "#src/domain"
import {
  assistantPartsRecord,
  assistantRecord,
  branchSummaryRecord,
  customMessageRecord,
  observationsRecord,
  shellRecord,
  toolCallPart,
  toolResultRecord,
  userRecord,
  withoutTime,
} from "#test-helpers"

describe("chunkText", () => {
  it("each source entry is labelled with its id and rendered with its role and local minute", () => {
    const records = [userRecord("1", "hi", 1), assistantRecord("2", "hello", 2)]

    expect(chunkText(records, { fromId: "1", coversUpToId: "2" }, 100)).toBe(
      "[Source entry id: 1]\n[User @ 2026-10-26 13:35]: hi\n\n[Source entry id: 2]\n[Assistant @ 2026-10-26 13:35]: hello",
    )
  })

  it("a tool call renders as its name with its JSON arguments, and an assistant with only tool calls still renders", () => {
    const records = [
      assistantPartsRecord("1", [{ kind: "text", text: "reading" }, toolCallPart('read({"path":"a.md"})')], 5),
      assistantPartsRecord("2", [toolCallPart('ls({"path":"."})')], 3),
    ]

    expect(chunkText(records, { fromId: "1", coversUpToId: "2" }, 100)).toBe(
      '[Source entry id: 1]\n[Assistant @ 2026-10-26 13:35]: reading\n[read({"path":"a.md"})]\n\n[Source entry id: 2]\n[Assistant @ 2026-10-26 13:35]: [ls({"path":"."})]',
    )
  })

  it("a tool result names its tool, a shell command shows command and output, custom messages name their type", () => {
    const records = [
      toolResultRecord("1", "read", "file text", 2),
      shellRecord("2", "ls\na.md", 2),
      customMessageRecord("3", "note", "custom text", 2),
      branchSummaryRecord("4", "summary text", 2),
    ]

    expect(chunkText(records, { fromId: "1", coversUpToId: "4" }, 100)).toBe(
      [
        "[Source entry id: 1]\n[Tool result for read @ 2026-10-26 13:35]: file text",
        "[Source entry id: 2]\n[Shell command @ 2026-10-26 13:35]: ls\na.md",
        "[Source entry id: 3]\n[Custom (note) @ 2026-10-26 13:35]: custom text",
        "[Source entry id: 4]\n[Branch summary @ ????-??-?? ??:??]: summary text",
      ].join("\n\n"),
    )
  })

  it("an entry without a time shows question marks", () => {
    const records = [withoutTime(userRecord("1", "hi", 1))]

    expect(chunkText(records, { fromId: "1", coversUpToId: "1" }, 100)).toBe(
      "[Source entry id: 1]\n[User @ ????-??-?? ??:??]: hi",
    )
  })

  it("a body longer than the block limit is cut and says how many characters were left out", () => {
    const records = [userRecord("1", "abcdefghijkl", 3)]

    expect(chunkText(records, { fromId: "1", coversUpToId: "1" }, 2)).toBe(
      "[Source entry id: 1]\n[User @ 2026-10-26 13:35]: abcdefgh\n[… 4 characters left out]",
    )
  })

  it("only the entries inside the range are rendered, and empty bodies are skipped", () => {
    const records = [
      userRecord("1", "before", 1),
      userRecord("2", "inside", 1),
      observationsRecord("3", "1", "1", []),
      assistantRecord("4", "", 0),
      assistantRecord("5", "also inside", 1),
      userRecord("6", "after", 1),
    ]

    expect(chunkText(records, { fromId: "2", coversUpToId: "5" }, 100)).toBe(
      "[Source entry id: 2]\n[User @ 2026-10-26 13:35]: inside\n\n[Source entry id: 5]\n[Assistant @ 2026-10-26 13:35]: also inside",
    )
  })
})
