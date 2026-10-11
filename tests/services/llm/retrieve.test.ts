import { describe, expect, it } from "vitest"

import { retrieveStep } from "#/services"
import { completionPort, memoryDraft, retrievalRequest } from "#test-helpers"

describe("retrieveStep", () => {
  it.each(["add", "update", "archive", "succeed", "clarify", "execute"])("rejects %s", async (action) => {
    const text = JSON.stringify({ action, vault: "global", note: memoryDraft() })
    expect((await retrieveStep(retrievalRequest(), completionPort(text))).succeeded).toBe(false)
  })

  it.each([
    { action: "search", vault: "global", query: "token", limit: 5 },
    { action: "get", vault: "global", path: "profile/Access token.md" },
    { action: "list", vault: "global", folder: "" },
    { action: "finish", notes: [] },
  ])("accepts only read intentions $action", async (action) => {
    expect(await retrieveStep(retrievalRequest(), completionPort(JSON.stringify(action)))).toEqual({
      succeeded: true,
      output: action,
    })
  })
})
