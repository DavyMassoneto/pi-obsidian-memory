import { describe, expect, it } from "vitest"

import { planVectorRefresh, type VectorCache } from "#src/domain"
import { catalogEntry, catalogEntryWithNote } from "#test-helpers"

const first = { ...catalogEntry("tools/A.md"), contentFingerprint: "fp-a" }
const second = { ...catalogEntry("tools/B.md"), contentFingerprint: "fp-b" }
const cache: VectorCache = {
  generation: { fingerprint: "provider-one", dimensions: 2 },
  chunks: [
    { contentFingerprint: "fp-a", chunk: 0, vector: [1, 0] },
    { contentFingerprint: "fp-a", chunk: 1, vector: [0, 1] },
    { contentFingerprint: "fp-b", chunk: 0, vector: [1, 1] },
  ],
}

describe("planVectorRefresh", () => {
  it("embeds nothing and keeps every chunk when the content is covered", () => {
    expect(planVectorRefresh([first, second], cache, "provider-one")).toEqual({ embed: [], keep: cache.chunks })
  })

  it("embeds nothing for a date-only change or a move", () => {
    const touched = { ...first, rawHash: "raw-two", stat: { size: 120, mtimeMs: 2000 } }
    const moved = { ...second, path: "other/B.md" }
    expect(planVectorRefresh([touched, moved], cache, "provider-one")).toEqual({ embed: [], keep: cache.chunks })
  })

  it("embeds the entry whose content changed and drops the old chunks", () => {
    const edited = { ...second, contentFingerprint: "fp-b2" }
    expect(planVectorRefresh([first, edited], cache, "provider-one")).toEqual({
      embed: [edited],
      keep: cache.chunks.slice(0, 2),
    })
  })

  it("drops the chunks of removed entries", () => {
    expect(planVectorRefresh([first], cache, "provider-one")).toEqual({ embed: [], keep: cache.chunks.slice(0, 2) })
  })

  it("embeds every entry and keeps nothing when the provider fingerprint changed", () => {
    expect(planVectorRefresh([first, second], cache, "provider-two")).toEqual({ embed: [first, second], keep: [] })
  })

  it("embeds every entry when the cache has no generation", () => {
    expect(planVectorRefresh([first, second], { generation: null, chunks: [] }, "provider-one")).toEqual({
      embed: [first, second],
      keep: [],
    })
  })

  it("embeds a new entry", () => {
    const added = { ...catalogEntry("tools/C.md"), contentFingerprint: "fp-c" }
    expect(planVectorRefresh([first, second, added], cache, "provider-one")).toEqual({
      embed: [added],
      keep: cache.chunks,
    })
  })

  it("embeds one entry per content fingerprint", () => {
    const copy = { ...first, path: "tools/Copy.md" }
    const added = { ...catalogEntry("tools/C.md"), contentFingerprint: "fp-c" }
    const copied = { ...added, path: "tools/C2.md" }
    expect(planVectorRefresh([first, copy, added, copied], cache, "provider-one").embed).toEqual([added])
  })

  it("ignores archived notes, invalid files and entries without a content fingerprint", () => {
    const archived = {
      ...catalogEntryWithNote("tools/Old.md", { archived: true }),
      contentFingerprint: "fp-old",
    }
    const invalid = { ...catalogEntry("tools/Bad.md"), note: null, contentFingerprint: "fp-bad" }
    const unfingerprinted = { ...catalogEntry("tools/None.md"), contentFingerprint: null }
    expect(planVectorRefresh([first, archived, invalid, unfingerprinted], cache, "provider-two")).toEqual({
      embed: [first],
      keep: [],
    })
  })

  it("drops the chunks of an archived note", () => {
    const archived = { ...catalogEntryWithNote("tools/B.md", { archived: true }), contentFingerprint: "fp-b" }
    expect(planVectorRefresh([first, archived], cache, "provider-one")).toEqual({
      embed: [],
      keep: cache.chunks.slice(0, 2),
    })
  })
})
