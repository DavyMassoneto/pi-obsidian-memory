import { expect, test } from "vitest"

import { applyIndexChanges, readVectorCache, replaceVectorCache } from "#src/services"
import { catalogChanges, catalogEntry, useIndexFile } from "#test-helpers"

test("keeps semantic chunks through moves and stat/date changes, drops changed content", async () => {
  const { index } = await useIndexFile()
  const first = catalogEntry("tools/First.md")
  applyIndexChanges(index, catalogChanges([first], 0))
  const generation = { fingerprint: "local/model/revision/pooling/chunking", dimensions: 2 }
  const chunks = [{ contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }]
  expect(replaceVectorCache(index, { expectedRevision: 1, generation, chunks })).toEqual({ succeeded: true })
  const moved = { ...first, path: "other/First.md", rawHash: "date-only" }
  applyIndexChanges(index, { ...catalogChanges([moved], 1), deletes: [first.path] })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation, chunks } })
  applyIndexChanges(index, catalogChanges([{ ...moved, contentFingerprint: "semantic-two" }], 2))
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation, chunks: [] } })
})

test("provider switch is atomic and refuses stale, nonfinite, zero or mismatched generations", async () => {
  const { index } = await useIndexFile()
  applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))
  const generation = { fingerprint: "first-provider", dimensions: 2 }
  const chunks = [{ contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }]
  replaceVectorCache(index, { expectedRevision: 1, generation, chunks })
  const before = readVectorCache(index)
  for (const vector of [[Number.NaN, 1], [Number.POSITIVE_INFINITY, 1], [0, 0], [1]]) {
    const request = {
      expectedRevision: 1,
      generation,
      chunks: [{ contentFingerprint: "semantic-one", chunk: 0, vector }],
    }
    expect(replaceVectorCache(index, request)).toMatchObject({ succeeded: false, reason: "invalid" })
  }
  expect(replaceVectorCache(index, { expectedRevision: 0, generation, chunks })).toMatchObject({
    succeeded: false,
    reason: "conflict",
  })
  const next = { fingerprint: "second", dimensions: 3 }
  expect(readVectorCache(index)).toEqual(before)
  const replacement = [{ contentFingerprint: "semantic-one", chunk: 0, vector: [0, 1, 0] }]
  expect(replaceVectorCache(index, { expectedRevision: 1, generation: next, chunks: replacement })).toEqual({
    succeeded: true,
  })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation: next, chunks: replacement } })
})
