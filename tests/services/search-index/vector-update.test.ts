import { expect, test } from "vitest"

import {
  applyIndexChanges,
  openIndex,
  readVectorCache,
  readVectorCoverage,
  replaceVectorCache,
  updateVectorCache,
} from "#src/services"
import {
  catalogChanges,
  chunkFor,
  entryWithContent,
  populatedIndex,
  TEST_GENERATION,
  useIndexFile,
} from "#test-helpers"

test("a replacement may cover only part of the current content and reports its coverage", async () => {
  const { index } = await populatedIndex()
  const chunks = [chunkFor("alpha", 0, [1, 0])]
  expect(replaceVectorCache(index, { expectedRevision: 1, generation: TEST_GENERATION, chunks })).toEqual({
    succeeded: true,
  })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation: TEST_GENERATION, chunks } })
  expect(readVectorCoverage(index)).toEqual({
    succeeded: true,
    output: { generation: TEST_GENERATION, embedded: 1, current: 3 },
  })
})

test("reports no generation and zero coverage before any vector exists, ignoring archived notes", async () => {
  const { index } = await useIndexFile()
  const entries = [entryWithContent("alpha", false), entryWithContent("old", true)]
  applyIndexChanges(index, catalogChanges(entries, 0))
  expect(readVectorCoverage(index)).toEqual({
    succeeded: true,
    output: { generation: null, embedded: 0, current: 1 },
  })
})

test("adds and removes vectors incrementally and keeps an interrupted first embedding across reopen", async () => {
  const { index, path } = await populatedIndex()
  const first = { expectedRevision: 1, generation: TEST_GENERATION, add: [chunkFor("alpha", 0, [1, 0])], remove: [] }
  expect(updateVectorCache(index, first)).toEqual({ succeeded: true })
  index.close()

  const reopened = openIndex(path)
  if (!reopened.succeeded) throw new Error(reopened.problems.join("; "))
  const second = {
    expectedRevision: 1,
    generation: TEST_GENERATION,
    add: [chunkFor("beta", 0, [0, 1]), chunkFor("beta", 1, [1, 1])],
    remove: [],
  }
  expect(updateVectorCache(reopened.output, second)).toEqual({ succeeded: true })
  expect(readVectorCoverage(reopened.output)).toMatchObject({ output: { embedded: 2, current: 3 } })

  const removal = { expectedRevision: 1, generation: TEST_GENERATION, add: [], remove: ["content-alpha"] }
  expect(updateVectorCache(reopened.output, removal)).toEqual({ succeeded: true })
  expect(readVectorCache(reopened.output)).toEqual({
    succeeded: true,
    output: { generation: TEST_GENERATION, chunks: second.add },
  })
  reopened.output.close()
})

test("re-adding a fingerprint replaces all of its chunks", async () => {
  const { index } = await populatedIndex()
  const generation = TEST_GENERATION
  updateVectorCache(index, {
    expectedRevision: 1,
    generation,
    add: [chunkFor("alpha", 0, [1, 0]), chunkFor("alpha", 1, [0, 1])],
    remove: [],
  })
  const shorter = [chunkFor("alpha", 0, [1, 1])]
  expect(updateVectorCache(index, { expectedRevision: 1, generation, add: shorter, remove: [] })).toEqual({
    succeeded: true,
  })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation, chunks: shorter } })
})

test("a different provider fingerprint or dimension invalidates every earlier vector", async () => {
  const { index } = await populatedIndex()
  updateVectorCache(index, {
    expectedRevision: 1,
    generation: TEST_GENERATION,
    add: [chunkFor("alpha", 0, [1, 0]), chunkFor("beta", 0, [0, 1])],
    remove: [],
  })
  const next = { fingerprint: "openai/other", dimensions: 3 }
  const added = [chunkFor("gamma", 0, [0, 0, 1])]
  expect(updateVectorCache(index, { expectedRevision: 1, generation: next, add: added, remove: [] })).toEqual({
    succeeded: true,
  })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation: next, chunks: added } })
  const sameFingerprint = { fingerprint: next.fingerprint, dimensions: 2 }
  updateVectorCache(index, { expectedRevision: 1, generation: sameFingerprint, add: [], remove: [] })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation: sameFingerprint, chunks: [] } })
})

test("refuses stale, unknown, archived, malformed or overlapping updates and leaves the cache untouched", async () => {
  const { index } = await useIndexFile()
  const entries = [entryWithContent("alpha", false), entryWithContent("old", true)]
  applyIndexChanges(index, catalogChanges(entries, 0))
  const generation = TEST_GENERATION
  updateVectorCache(index, { expectedRevision: 1, generation, add: [chunkFor("alpha", 0, [1, 0])], remove: [] })
  const before = readVectorCache(index)
  const alpha = chunkFor("alpha", 0, [1, 0])
  const invalid = [
    { expectedRevision: 1, generation, add: [chunkFor("missing", 0, [1, 0])], remove: [] },
    { expectedRevision: 1, generation, add: [chunkFor("old", 0, [1, 0])], remove: [] },
    { expectedRevision: 1, generation, add: [chunkFor("alpha", 0, [0, 0])], remove: [] },
    { expectedRevision: 1, generation, add: [chunkFor("alpha", 0, [Number.NaN, 1])], remove: [] },
    { expectedRevision: 1, generation, add: [chunkFor("alpha", 0, [1])], remove: [] },
    { expectedRevision: 1, generation, add: [chunkFor("alpha", 1, [1, 0])], remove: [] },
    { expectedRevision: 1, generation, add: [alpha, alpha], remove: [] },
    { expectedRevision: 1, generation, add: [alpha], remove: ["content-alpha"] },
  ]
  for (const request of invalid) {
    expect(updateVectorCache(index, request)).toMatchObject({ succeeded: false, reason: "invalid" })
  }
  expect(updateVectorCache(index, { expectedRevision: 0, generation, add: [], remove: [] })).toMatchObject({
    succeeded: false,
    reason: "conflict",
  })
  expect(readVectorCache(index)).toEqual(before)
})

test("content that leaves the catalog is pruned from a partial cache and coverage follows", async () => {
  const { index } = await populatedIndex()
  updateVectorCache(index, {
    expectedRevision: 1,
    generation: TEST_GENERATION,
    add: [chunkFor("alpha", 0, [1, 0]), chunkFor("beta", 0, [0, 1])],
    remove: [],
  })
  applyIndexChanges(index, { ...catalogChanges([], 1), deletes: ["tools/alpha.md"] })
  expect(readVectorCoverage(index)).toEqual({
    succeeded: true,
    output: { generation: TEST_GENERATION, embedded: 1, current: 2 },
  })
})

test("refuses updates and coverage reads on a closed index", async () => {
  const { index } = await populatedIndex()
  index.close()
  const request = { expectedRevision: 1, generation: TEST_GENERATION, add: [], remove: [] }
  expect(updateVectorCache(index, request)).toMatchObject({ succeeded: false, reason: "closed" })
  expect(readVectorCoverage(index)).toMatchObject({ succeeded: false, reason: "closed" })
})
