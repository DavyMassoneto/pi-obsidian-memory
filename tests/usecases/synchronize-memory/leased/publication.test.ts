import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#src/usecases"
import {
  changeIndexFile,
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  validFrontmatterLines,
} from "#test-helpers"

test("unrelated SQLite transaction failures propagate without rebuilding or running later folder maintenance", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory first"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = synchronizedCatalog(path).inventory
  changeIndexFile(
    path,
    "CREATE TRIGGER reject_sync BEFORE INSERT ON notes BEGIN SELECT RAISE(ABORT, 'sync denied'); END;",
  )
  const bytes = await readFile(path)
  const folderIndex = await readFile(join(vault.path, "index.md"))
  const text = noteText(validFrontmatterLines(), "memory changed")
  await putCatalogFile(vault, "Note.md", text)
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "unavailable",
    problems: [expect.stringContaining("sync denied")],
    progress: { committed: false, revision: before.revision },
  })
  expect(synchronizedCatalog(path).inventory).toEqual(before)
  expect(await readFile(path)).toEqual(bytes)
  expect(await readFile(join(vault.path, "index.md"))).toEqual(folderIndex)
  expect(await readFile(join(vault.path, "Note.md"), "utf8")).toBe(text)
  await expectRegistrationLeaseReleased(context)
})
