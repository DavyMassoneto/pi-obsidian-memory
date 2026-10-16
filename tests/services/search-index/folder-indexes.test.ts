import { expect, test } from "vitest"

import { openIndex, readFolderIndexStates, recordFolderIndexStates } from "#src/services"
import { changeIndexFile, folderIndexState, useIndexFile } from "#test-helpers"

test("round-trips recorded folder index states ordered by folder, including the root", async () => {
  const { index } = await useIndexFile()
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [] })
  const states = [folderIndexState("tools", "b"), folderIndexState("", "a"), folderIndexState("tools/pnpm", "c")]
  expect(recordFolderIndexStates(index, states, ["", "tools", "tools/pnpm"])).toEqual({ succeeded: true })
  expect(readFolderIndexStates(index)).toEqual({
    succeeded: true,
    output: [states[1], states[0], states[2]],
  })
})

test("prunes folders outside keepFolders, even those without a state to record", async () => {
  const { index } = await useIndexFile()
  const states = [folderIndexState("", "a"), folderIndexState("tools", "b"), folderIndexState("gone", "c")]
  recordFolderIndexStates(index, states, ["", "tools", "gone"])
  const kept = folderIndexState("tools", "b2")
  expect(recordFolderIndexStates(index, [kept], ["", "tools"])).toEqual({ succeeded: true })
  expect(readFolderIndexStates(index)).toEqual({
    succeeded: true,
    output: [folderIndexState("", "a"), kept],
  })
  expect(recordFolderIndexStates(index, [], [])).toEqual({ succeeded: true })
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [] })
})

test("overwrites the stored state of a folder on upsert", async () => {
  const { index } = await useIndexFile()
  recordFolderIndexStates(index, [folderIndexState("tools", "old")], ["tools"])
  const next = {
    folder: "tools",
    fingerprint: "new",
    indexSize: 7,
    indexMtimeMs: 42.25,
    indexCtimeMs: 43.5,
    indexIno: "18446744073709551615",
  }
  expect(recordFolderIndexStates(index, [next], ["tools"])).toEqual({ succeeded: true })
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [next] })
})

test("keeps states across reopen and empties them when a version mismatch rebuilds the index", async () => {
  const { index, path } = await useIndexFile()
  recordFolderIndexStates(index, [folderIndexState("tools", "a")], ["tools"])
  index.close()
  const reopened = openIndex(path)
  if (!reopened.succeeded) throw new Error("open failed")
  expect(reopened.rebuilt).toBe(false)
  expect(readFolderIndexStates(reopened.output)).toEqual({ succeeded: true, output: [folderIndexState("tools", "a")] })
  reopened.output.close()
  changeIndexFile(path, "PRAGMA user_version = 2")
  const migrated = openIndex(path)
  if (!migrated.succeeded) throw new Error("migration failed")
  expect(migrated.rebuilt).toBe(true)
  expect(readFolderIndexStates(migrated.output)).toEqual({ succeeded: true, output: [] })
  migrated.output.close()
})

test("refuses reads and writes on a closed index", async () => {
  const { index } = await useIndexFile()
  index.close()
  expect(readFolderIndexStates(index)).toMatchObject({ succeeded: false, reason: "closed" })
  expect(recordFolderIndexStates(index, [folderIndexState("tools", "a")], ["tools"])).toMatchObject({
    succeeded: false,
    reason: "closed",
  })
})

test("rejects invalid states without changing the stored ones", async () => {
  const { index } = await useIndexFile()
  const stored = folderIndexState("tools", "a")
  recordFolderIndexStates(index, [stored], ["tools"])
  const invalid = [
    { ...stored, fingerprint: "" },
    { ...stored, indexSize: -1 },
    { ...stored, indexSize: 1.5 },
    { ...stored, indexMtimeMs: Number.NaN },
    { ...stored, indexCtimeMs: Number.NaN },
    { ...stored, indexIno: "" },
  ]
  for (const state of invalid) {
    expect(recordFolderIndexStates(index, [state], ["tools"])).toMatchObject({ succeeded: false, reason: "invalid" })
  }
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [stored] })
})

test("reports corrupted rows and releases the read transaction", async () => {
  const { index, path } = await useIndexFile()
  const stored = folderIndexState("tools", "a")
  recordFolderIndexStates(index, [stored], ["tools"])
  changeIndexFile(path, "UPDATE folder_indexes SET index_size = -1")
  expect(readFolderIndexStates(index)).toMatchObject({ succeeded: false, reason: "corrupted" })
  changeIndexFile(path, "UPDATE folder_indexes SET index_size = 'x'")
  expect(readFolderIndexStates(index)).toMatchObject({ succeeded: false, reason: "corrupted" })
  changeIndexFile(path, "UPDATE folder_indexes SET index_size = 1, index_ino = x'01'")
  expect(readFolderIndexStates(index)).toMatchObject({ succeeded: false, reason: "corrupted" })
  expect(recordFolderIndexStates(index, [stored], ["tools"])).toEqual({ succeeded: true })
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [stored] })
})
