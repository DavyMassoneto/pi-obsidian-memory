import { describe, expect, it } from "vitest"

import { assignObservationIds, recordedData } from "#src/domain"
import { chunkRange, observation } from "#test-helpers"

describe("assignObservationIds", () => {
  it("a minute timestamp becomes a second-resolution id, and collisions get the first free suffix", () => {
    const used = new Set(["2026-10-26T13:35:00", "2026-10-26T13:35:00.01"])
    const drafts = [
      { timestamp: "2026-10-26 13:35", content: "collides" },
      { timestamp: "2026-10-26 13:40", content: "free" },
    ]

    expect(assignObservationIds(drafts, used).map((item) => item.id)).toEqual([
      "2026-10-26T13:35:00.02",
      "2026-10-26T13:40:00",
    ])
  })

  it("drafts of one reply with the same minute get distinct ids", () => {
    const drafts = [
      { timestamp: "2026-10-26 13:35", content: "first" },
      { timestamp: "2026-10-26 13:35", content: "second" },
      { timestamp: "2026-10-26 13:35", content: "third" },
    ]

    expect(assignObservationIds(drafts, new Set()).map((item) => item.id)).toEqual([
      "2026-10-26T13:35:00",
      "2026-10-26T13:35:00.01",
      "2026-10-26T13:35:00.02",
    ])
  })

  it("tokens are counted from the content", () => {
    const drafts = [{ timestamp: "2026-10-26 13:35", content: "abcde" }]

    expect(assignObservationIds(drafts, new Set())).toEqual([
      { id: "2026-10-26T13:35:00", content: "abcde", tokens: 2 },
    ])
  })
})

describe("recordedData", () => {
  it("recorded data carries the chunk range and the observations", () => {
    const observations = [observation("2026-10-26T13:35:00", "one")]

    expect(recordedData(chunkRange("u1", "a3"), observations)).toEqual({
      fromId: "u1",
      coversUpToId: "a3",
      observations,
    })
  })
})
