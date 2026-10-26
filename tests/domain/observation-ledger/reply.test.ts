import { describe, expect, it } from "vitest"

import { parseObserverReply } from "#src/domain"
import { observerReply } from "#test-helpers"

describe("parseObserverReply", () => {
  it("a reply with observations gives drafts with single-line trimmed contents", () => {
    const text = observerReply([
      { timestamp: "2026-10-26 13:35", content: "  User asked\r\nfor a CSV export.\n\n" },
      { timestamp: "2026-10-26 13:36", content: "Assistant added the button." },
    ])

    expect(parseObserverReply(text)).toEqual({
      succeeded: true,
      output: [
        { timestamp: "2026-10-26 13:35", content: "User asked for a CSV export." },
        { timestamp: "2026-10-26 13:36", content: "Assistant added the button." },
      ],
    })
  })

  it("an empty observation list is a valid reply", () => {
    expect(parseObserverReply(observerReply([]))).toEqual({ succeeded: true, output: [] })
  })

  it("contents that are empty after trimming are dropped", () => {
    const text = observerReply([
      { timestamp: "2026-10-26 13:35", content: " \r\n " },
      { timestamp: "2026-10-26 13:36", content: "kept" },
    ])

    expect(parseObserverReply(text)).toEqual({
      succeeded: true,
      output: [{ timestamp: "2026-10-26 13:36", content: "kept" }],
    })
  })

  it("text that is not JSON, extra keys or a wrong timestamp form are refused with a reason", () => {
    const refusals = [
      parseObserverReply("observations: none"),
      parseObserverReply(JSON.stringify({ observations: [], note: "extra" })),
      parseObserverReply(JSON.stringify({ observations: [{ timestamp: "2026-10-26T13:35", content: "x" }] })),
      parseObserverReply(JSON.stringify({ observations: [{ timestamp: "2026-10-26 13:35", content: "" }] })),
    ]

    for (const refusal of refusals) {
      expect(refusal.succeeded).toBe(false)
      if (!refusal.succeeded) expect(refusal.problems.length).toBeGreaterThan(0)
    }
    expect(refusals[0]).toEqual({ succeeded: false, problems: ["Invalid observer JSON"] })
  })

  it("the same timestamp and content twice in one reply is kept once", () => {
    const text = observerReply([
      { timestamp: "2026-10-26 13:35", content: "same" },
      { timestamp: "2026-10-26 13:35", content: " same " },
      { timestamp: "2026-10-26 13:36", content: "same" },
    ])

    expect(parseObserverReply(text)).toEqual({
      succeeded: true,
      output: [
        { timestamp: "2026-10-26 13:35", content: "same" },
        { timestamp: "2026-10-26 13:36", content: "same" },
      ],
    })
  })
})
