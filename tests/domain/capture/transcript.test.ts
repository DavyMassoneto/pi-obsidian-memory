import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { CaptureInputSchema, type TranscriptMessage, transcriptWindows } from "#src/domain"
import { captureRequest } from "#test-helpers"

describe("transcriptWindows", () => {
  it("returns no window for no messages", () => {
    expect(transcriptWindows([])).toEqual([])
  })

  it("drops messages with empty text", () => {
    expect(transcriptWindows([{ role: "user", text: "" }])).toEqual([])
    expect(
      transcriptWindows([
        { role: "user", text: "" },
        { role: "assistant", text: "ok" },
      ]),
    ).toEqual([[{ role: "assistant", text: "ok" }]])
  })

  it("keeps up to 100 messages in one window", () => {
    const messages: TranscriptMessage[] = Array.from({ length: 100 }, (_, index) => ({
      role: "user",
      text: `m${index}`,
    }))
    expect(transcriptWindows(messages)).toEqual([messages])
  })

  it("splits 101 messages into two windows in order", () => {
    const messages: TranscriptMessage[] = Array.from({ length: 101 }, (_, index) => ({
      role: "user",
      text: `m${index}`,
    }))
    expect(transcriptWindows(messages)).toEqual([messages.slice(0, 100), messages.slice(100)])
  })

  it("keeps a text of exactly 16000 characters whole", () => {
    const text = "a".repeat(16000)
    expect(transcriptWindows([{ role: "user", text }])).toEqual([[{ role: "user", text }]])
  })

  it("splits a 40000-character message into 3 ordered parts with its role", () => {
    const text = "a".repeat(16000) + "b".repeat(16000) + "c".repeat(8000)
    expect(transcriptWindows([{ role: "assistant", text }])).toEqual([
      [
        { role: "assistant", text: "a".repeat(16000) },
        { role: "assistant", text: "b".repeat(16000) },
        { role: "assistant", text: "c".repeat(8000) },
      ],
    ])
  })

  it("counts the parts of a long message against the 100-item window", () => {
    const long: TranscriptMessage = { role: "user", text: "x".repeat(32001) }
    const short: TranscriptMessage[] = Array.from({ length: 98 }, () => ({ role: "assistant", text: "ok" }))
    const windows = transcriptWindows([...short, long])
    expect(windows.map((window) => window.length)).toEqual([100, 1])
    expect(windows[1]).toEqual([{ role: "user", text: "x" }])
  })

  it("does not cut a surrogate pair at a part boundary", () => {
    const text = `${"a".repeat(15999)}😀tail`
    const [window] = transcriptWindows([{ role: "user", text }])
    expect(window?.map((part) => part.text)).toEqual(["a".repeat(15999), "😀tail"])
  })

  it("produces windows that fit the capture input schema limits", () => {
    const messages: TranscriptMessage[] = Array.from({ length: 150 }, () => ({ role: "user", text: "z".repeat(40000) }))
    const { context, observations, explicitSaves, limits } = captureRequest()
    const windows = transcriptWindows(messages)
    expect(windows.length).toBe(5)
    for (const transcriptDelta of windows) {
      expect(Value.Check(CaptureInputSchema, { context, transcriptDelta, observations, explicitSaves, limits })).toBe(
        true,
      )
    }
  })
})
