import { expect, test } from "vitest"

import { readFolderIndexStates, recordFolderIndexStates } from "#src/services"
import { changeIndexFile, folderIndexState, useIndexFile } from "#test-helpers"

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

test.each(["FAIL", "ABORT", "ROLLBACK"])("keeps every previous state when a write is refused with %s", async (mode) => {
  const { index, path } = await useIndexFile()
  const stored = folderIndexState("tools", "a")
  recordFolderIndexStates(index, [stored], ["tools"])
  changeIndexFile(
    path,
    `CREATE TRIGGER reject_folder BEFORE INSERT ON folder_indexes WHEN new.folder = 'bad' BEGIN SELECT RAISE(${mode}, 'refused'); END;`,
  )
  const states = [folderIndexState("tools", "b"), folderIndexState("bad", "c")]
  expect(recordFolderIndexStates(index, states, ["tools", "bad"])).toMatchObject({
    succeeded: false,
    reason: "unavailable",
  })
  expect(readFolderIndexStates(index)).toEqual({ succeeded: true, output: [stored] })
})
