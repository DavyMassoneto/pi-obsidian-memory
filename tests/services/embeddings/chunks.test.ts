import { describe, expect, it } from "vitest"

import { chunkText, prepareChunks } from "#src/services"

describe("chunkText", () => {
  it("preserves all text with bounded overlap and includes prefix in token budget", () => {
    const measure = (text: string) => [...text].length + 2
    const policy = { maximum: 12, overlap: 4, measure, prefix: "p: " }
    expect(chunkText("abcdefghijklmnop", policy)).toEqual(["p: abcdefg", "p: fghijkl", "p: klmnop"])
    expect(chunkText("🌎".repeat(9), policy)).toEqual(["p: 🌎🌎🌎🌎🌎🌎🌎", "p: 🌎🌎🌎🌎"])
    expect(chunkText("x", { ...policy, maximum: 5 })).toBeNull()
  })

  it("refuses too many chunks rather than omitting a tail", () => {
    const policy = { maximum: 2, overlap: 0, measure: (text: string) => text.length, prefix: "" }
    expect(chunkText("x".repeat(513), policy)).toBeNull()
  })
})

describe("prepareChunks", () => {
  it("rejects duplicate keys, empty input and excessive batch limits before inference", () => {
    const policy = { maximum: 4096, overlap: 128, measure: (text: string) => text.length, prefix: "" }
    expect(prepareChunks({ purpose: "query", inputs: [] }, policy)).toEqual({
      succeeded: false,
      status: "invalid-input",
    })
    expect(prepareChunks({ purpose: "query", inputs: [{ key: "a", text: "" }] }, policy)).toEqual({
      succeeded: false,
      status: "invalid-input",
    })
    const duplicate = prepareChunks(
      {
        purpose: "query",
        inputs: [
          { key: "a", text: "x" },
          { key: "a", text: "y" },
        ],
      },
      policy,
    )
    expect(duplicate).toEqual({ succeeded: false, status: "invalid-input" })
    const inputs = Array.from({ length: 33 }, (_, index) => ({ key: String(index), text: "x" }))
    expect(prepareChunks({ purpose: "query", inputs }, policy)).toEqual({ succeeded: false, status: "input-too-long" })
    const enormous = prepareChunks({ purpose: "document", inputs: [{ key: "a", text: "x".repeat(1_000_001) }] }, policy)
    expect(enormous).toEqual({ succeeded: false, status: "input-too-long" })
  })
})
