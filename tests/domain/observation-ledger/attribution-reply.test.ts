import { describe, expect, it } from "vitest"

import { parseAttributionReply } from "#src/domain"
import { csvVerdicts } from "#test-helpers"

describe("parseAttributionReply", () => {
  it("reads attribution verdicts and refuses anything else", () => {
    expect(parseAttributionReply(JSON.stringify({ verdicts: csvVerdicts() }))).toEqual({
      succeeded: true,
      output: csvVerdicts(),
    })
    expect(parseAttributionReply("supported")).toEqual({ succeeded: false, problems: ["Invalid attribution JSON"] })
    expect(parseAttributionReply(JSON.stringify({ verdicts: [{ id: 1 }] }))).toMatchObject({ succeeded: false })
  })

  it("a verdict that carries fields nobody asked for is read without them, instead of losing the whole reply", () => {
    const chatty = csvVerdicts().map((item) => ({ ...item, content: "repeated text", note: "extra" }))

    expect(parseAttributionReply(JSON.stringify({ verdicts: chatty, comment: "done" }))).toEqual({
      succeeded: true,
      output: csvVerdicts(),
    })
  })
})
