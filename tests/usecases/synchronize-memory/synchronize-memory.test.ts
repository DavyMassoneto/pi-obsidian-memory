import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { openIndex } from "#src/services"
import { getMemory, synchronizeMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  memoryReadTree,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  tryLinkFile,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("populates exact searchable rows, diagnostics and duplicate identities without minting receipts", async () => {
  const { vault, context } = await memoryReadFixture()
  for (const path of ["topic/Note.MD", ".Rule.md", ".md", "[bad].md", "archive/Old.md"]) {
    await putCatalogFile(vault, path, noteText(validFrontmatterLines(), "memory detail"))
  }
  await putCatalogFile(vault, "Invalid.md", noteText([...validFrontmatterLines(), "unknown: x"], "memory"))
  await putCatalogFile(vault, "Blank.md", "")
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { population: "ready", coverage: "complete", committed: true },
  })
  const { inventory, hits } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.map((entry) => entry.path).sort()).toEqual([
    ".Rule.md",
    ".md",
    "Blank.md",
    "Invalid.md",
    "[bad].md",
    "archive/Old.md",
    "topic/Note.MD",
  ])
  expect(hits.map((hit) => hit.path).sort()).toEqual([".Rule.md", ".md", "[bad].md", "topic/Note.MD"])
  expect(
    inventory.entries
      .filter((entry) => !entry.note)
      .map((entry) => entry.path)
      .sort(),
  ).toEqual(["Blank.md", "Invalid.md"])
  expect(result).toMatchObject({
    output: { duplicateIds: [{ paths: [".Rule.md", ".md", "[bad].md", "archive/Old.md", "topic/Note.MD"] }] },
  })
  expect(await readFile(join(vault.path, "index.md"), "utf8")).toContain("Needs fixing")
  expect(await readFile(join(vault.path, "topic/index.md"), "utf8")).toContain("Note")
  expect(await readdir(vault.path)).not.toContain("_templates")
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "topic/Note.MD" })).toBeNull()
  await expectRegistrationLeaseReleased(context)
})

test("reconciles additions, edits, moves, deletions and replacement by a directory", async () => {
  const { vault, context } = await memoryReadFixture()
  for (const path of ["old/Move.md", "Edit.md", "Delete.md", "Directory.md"]) {
    await putCatalogFile(vault, path, noteText(validFrontmatterLines(), "memory original"))
  }
  await synchronizeMemory({ vault: "global" }, context)
  await mkdir(join(vault.path, "new"))
  await rename(join(vault.path, "old/Move.md"), join(vault.path, "new/Moved.md"))
  await rm(join(vault.path, "old"), { recursive: true })
  await rm(join(vault.path, "Delete.md"))
  await rm(join(vault.path, "Directory.md"))
  await mkdir(join(vault.path, "Directory.md"))
  await putCatalogFile(vault, "Edit.md", noteText(validFrontmatterLines(), "memory changed body"))
  await putCatalogFile(vault, "Added.md", noteText(validFrontmatterLines(), "memory added"))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { warnings: [] },
  })
  const { inventory } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.map((entry) => entry.path).sort()).toEqual(["Added.md", "Edit.md", "new/Moved.md"])
  expect(inventory.entries.find((entry) => entry.path === "Edit.md")?.note?.body).toBe("memory changed body")
  expect(await readFile(join(vault.path, "index.md"), "utf8")).not.toContain("old/index")
})

test.each(["missing", "corrupt"])("rebuilds a %s catalog from actual note bytes", async (state) => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory truth"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = synchronizedCatalog(path)
  if (state === "missing") await rm(path)
  else await writeFile(path, "corrupt bytes")
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { population: "ready", rebuilt: true },
  })
  expect(synchronizedCatalog(path)).toEqual(before)
  await expectRegistrationLeaseReleased(context)
})

test("unchanged scans preserve catalog revision and bytes; missing indexes alone get repaired", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "topic/Note.md", noteText(validFrontmatterLines(), "memory truth"))
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = synchronizedCatalog(path)
  const bytes = await readFile(path)
  const tree = await memoryReadTree(vault.path)
  const folderStat = await stat(join(vault.path, "topic/index.md"))
  await synchronizeMemory({ vault: "global" }, context)
  expect(synchronizedCatalog(path)).toEqual(before)
  expect(await readFile(path)).toEqual(bytes)
  expect(await memoryReadTree(vault.path)).toEqual(tree)
  expect(await stat(join(vault.path, "topic/index.md"))).toMatchObject({
    mtimeMs: folderStat.mtimeMs,
    ino: folderStat.ino,
  })
  await rm(join(vault.path, "topic/index.md"))
  await synchronizeMemory({ vault: "global" }, context)
  expect(synchronizedCatalog(path)).toEqual(before)
  expect(await memoryReadTree(vault.path)).toEqual(tree)
})

test("synchronizes only the longest current project, leaving other projects and global untouched", async () => {
  const { vault, root, config, context } = await memoryReadFixture()
  config.projects = [
    { name: "outer", folder: context.workingFolder, vault: join(root, "outer") },
    { name: "inner", folder: join(context.workingFolder, "inner"), vault: join(root, "inner") },
    { name: "other", folder: join(root, "elsewhere"), vault: join(root, "other") },
  ]
  for (const project of config.projects) {
    await mkdir(project.folder, { recursive: true })
    await putCatalogFile(
      { path: project.vault, limits: config.limits },
      "Note.md",
      noteText(validFrontmatterLines(), project.name),
    )
  }
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  context.workingFolder = join(context.workingFolder, "inner")
  const global = await memoryReadTree(vault.path)
  const outer = await memoryReadTree(join(root, "outer"))
  const other = await memoryReadTree(join(root, "other"))
  expect(await synchronizeMemory({ vault: "project" }, context)).toMatchObject({
    succeeded: true,
    output: { vault: "project" },
  })
  const path = await synchronizedIndexPath(context, join(root, "inner"))
  expect(synchronizedCatalog(path).inventory.entries[0]?.note?.body).toBe("inner")
  expect(await memoryReadTree(vault.path)).toEqual(global)
  expect(await memoryReadTree(join(root, "outer"))).toEqual(outer)
  expect(await memoryReadTree(join(root, "other"))).toEqual(other)
})

test("synchronization does not consume or refresh a prior get receipt", async () => {
  const { vault, context } = await memoryReadFixture()
  const address = { vault: "global", path: "Note.md" } as const
  await putCatalogFile(vault, address.path, noteText(validFrontmatterLines(), "memory first"))
  await getMemory({ ...address, sourceCallId: "get" }, context)
  const receipt = context.session.getReceipt(context.stamp, address)
  await putCatalogFile(vault, address.path, noteText(validFrontmatterLines(), "memory changed"))
  await synchronizeMemory({ vault: "global" }, context)
  expect(context.session.getReceipt(context.stamp, address)).toEqual(receipt)
  await writeFile(context.configPath, "{}")
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "stale-session",
  })
  expect(context.session.getReceipt(context.session.stamp(), address)).toBeNull()
})

test("a derived database link into the vault refuses before initialization or maintenance", async (testContext) => {
  const { vault, context, root } = await memoryReadFixture()
  const target = join(vault.path, "untouched.sqlite")
  const opened = openIndex(target)
  if (!opened.succeeded) throw new Error("fixture database required")
  opened.output.close()
  const path = await synchronizedIndexPath(context, vault.path)
  await mkdir(dirname(path), { recursive: true })
  if (!(await tryLinkFile(target, path))) testContext.skip()
  const before = await memoryReadTree(root)
  const bytes = await readFile(target)
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "unavailable",
  })
  expect(await memoryReadTree(root)).toEqual(before)
  expect(await readFile(target)).toEqual(bytes)
})
