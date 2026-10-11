import { expect, test } from "vitest"

import { applyIndexChanges, readVectorCache, replaceVectorCache } from "#/services"
import { catalogChanges, catalogEntry, changeIndexFile, useIndexFile } from "#test-helpers"

test.each(["FAIL", "ABORT", "ROLLBACK"])("keeps the previous generation on %s", async (mode) => {
  const { index, path } = await useIndexFile()
  applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))
  const generation = { fingerprint: "first", dimensions: 2 }
  const chunks = [{ contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }]
  replaceVectorCache(index, { expectedRevision: 1, generation, chunks })
  const before = readVectorCache(index)
  changeIndexFile(
    path,
    `CREATE TRIGGER reject_vectors AFTER INSERT ON vector_chunks BEGIN SELECT RAISE(${mode}, 'vector refused'); END;`,
  )
  const result = replaceVectorCache(index, {
    expectedRevision: 1,
    generation: { fingerprint: "second", dimensions: 3 },
    chunks: [{ contentFingerprint: "semantic-one", chunk: 0, vector: [0, 1, 0] }],
  })
  expect(result).toMatchObject({ succeeded: false, reason: "unavailable" })
  expect(readVectorCache(index)).toEqual(before)
})

test("validates cached JSON immediately and releases the read transaction after corrupt data", async () => {
  const { index, path } = await useIndexFile()
  applyIndexChanges(index, catalogChanges([catalogEntry("tools/First.md")], 0))
  const request = {
    expectedRevision: 1,
    generation: { fingerprint: "first", dimensions: 2 },
    chunks: [{ contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }],
  }
  replaceVectorCache(index, request)
  for (const json of ["not-json", "{}", "[0,0]", "[1]", "[1e999,0]"]) {
    changeIndexFile(path, `UPDATE vector_chunks SET vector = '${json}'`)
    expect(readVectorCache(index)).toMatchObject({ succeeded: false, reason: "corrupted" })
    expect(replaceVectorCache(index, request)).toEqual({ succeeded: true })
  }
  index.close()
  expect(readVectorCache(index)).toMatchObject({ succeeded: false, reason: "closed" })
  expect(replaceVectorCache(index, request)).toMatchObject({ succeeded: false, reason: "closed" })
})

test("chunk sequences are contiguous and unique and content removal prunes their cache", async () => {
  const { index } = await useIndexFile()
  const entry = catalogEntry("tools/First.md")
  applyIndexChanges(index, catalogChanges([entry], 0))
  const generation = { fingerprint: "first", dimensions: 2 }
  const first = { contentFingerprint: "semantic-one", chunk: 0, vector: [1, 0] }
  for (const chunks of [[{ ...first, chunk: 1 }], [first, first], [first, { ...first, chunk: 2 }]]) {
    expect(replaceVectorCache(index, { expectedRevision: 1, generation, chunks })).toMatchObject({
      succeeded: false,
      reason: "invalid",
    })
  }
  const chunks = [first, { ...first, chunk: 1, vector: [0, 1] }]
  expect(replaceVectorCache(index, { expectedRevision: 1, generation, chunks })).toEqual({ succeeded: true })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation, chunks } })
  expect(applyIndexChanges(index, { ...catalogChanges([], 1), deletes: [entry.path] })).toEqual({ succeeded: true })
  expect(readVectorCache(index)).toEqual({ succeeded: true, output: { generation, chunks: [] } })
})
