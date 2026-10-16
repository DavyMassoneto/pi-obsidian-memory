import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#src/usecases"
import {
  linkFolder,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  tryLinkFile,
  validFrontmatterLines,
} from "#test-helpers"

test("a note replaced by a direct archive alias retains exact identity but loses search eligibility", async (testContext) => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory"))
  await synchronizeMemory({ vault: "global" }, context)
  await mkdir(join(vault.path, "archive"))
  await rename(join(vault.path, "Note.md"), join(vault.path, "archive/Note.md"))
  if (!(await tryLinkFile(join(vault.path, "archive/Note.md"), join(vault.path, "Note.md")))) testContext.skip()
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { duplicateIds: [{ paths: ["Note.md", "archive/Note.md"] }] },
  })
  const { inventory, hits } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(hits).toEqual([])
  expect(inventory.entries).toHaveLength(2)
  expect(inventory.entries.every((entry) => entry.note?.archived)).toBe(true)
})

test("a directory replaced by an archive alias retires only prior alias-subtree catalog identities", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "subject/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "Unrelated.md", noteText(validFrontmatterLines(), "memory"))
  await synchronizeMemory({ vault: "global" }, context)
  await mkdir(join(vault.path, "archive"))
  await rename(join(vault.path, "subject"), join(vault.path, "archive/subject"))
  await linkFolder(join(vault.path, "archive/subject"), join(vault.path, "subject"))
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  const { inventory, hits } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.map((entry) => entry.path)).toEqual(["Unrelated.md", "archive/subject/Note.md"])
  expect(hits.map((hit) => hit.path)).toEqual(["Unrelated.md"])
})

test("direct file aliases are independent exact path rows and are revalidated after retargeting", async (testContext) => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory"))
  for (const alias of ["One.MD", "Two.md"]) {
    if (!(await tryLinkFile(join(vault.path, "Note.md"), join(vault.path, alias)))) testContext.skip()
  }
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { duplicateIds: [{ paths: ["Note.md", "One.MD", "Two.md"] }] },
  })
  await rm(join(vault.path, "One.MD"))
  if (!(await tryLinkFile(join(vault.path, "index.md"), join(vault.path, "One.MD")))) testContext.skip()
  await synchronizeMemory({ vault: "global" }, context)
  expect(
    synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
      .hits.map((hit) => hit.path)
      .sort(),
  ).toEqual(["Note.md", "Two.md"])
})
