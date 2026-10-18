import { rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { refreshFolders } from "#src/services"
import {
  aLimits,
  allowing,
  aNote,
  blockWrite,
  indexStatOnDisk,
  keepGoing,
  linkFolder,
  putNoteFile,
  tryLinkFile,
  useTempFolder,
} from "#test-helpers"

const limits = aLimits()

test("returns the index stat read from disk after writing and after finding the index unchanged", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))
  await putNoteFile(vault, "b", "Note", renderNote(aNote()))
  const context = { path: vault, name: "Memory", limits }

  const written = await refreshFolders(context, ["a", "b"], keepGoing, "exact")

  expect(written).toEqual({
    succeeded: true,
    refreshed: [
      { folder: "a", index: await indexStatOnDisk(vault, "a"), settled: true },
      { folder: "b", index: await indexStatOnDisk(vault, "b"), settled: true },
    ],
  })
  const unchanged = await refreshFolders(context, ["a", "b"], keepGoing, "exact")
  expect(unchanged).toEqual(written)
})

test("settles a folder whose notes are invalid or need fixing", async () => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "Broken.md"), "No frontmatter")

  const result = await refreshFolders({ path: vault, name: "Memory", limits }, [""], keepGoing, "exact")

  expect(result).toMatchObject({ succeeded: true, refreshed: [{ folder: "", settled: true }] })
})

test("does not settle a folder whose note leads outside the vault", async (context) => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await writeFile(join(outside, "Secret.md"), renderNote(aNote()))
  if (!(await tryLinkFile(join(outside, "Secret.md"), join(vault, "External.md"))))
    context.skip("this system cannot create file links")

  const result = await refreshFolders({ path: vault, name: "Memory", limits }, [""], keepGoing, "exact")

  expect(result).toMatchObject({ succeeded: true, refreshed: [{ folder: "", settled: false }] })
})

test("does not settle a folder that lists a subfolder leading outside the vault", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await putNoteFile(vault, "", "Note", renderNote(aNote()))
  await linkFolder(outside, join(vault, "escape"))

  const result = await refreshFolders({ path: vault, name: "Memory", limits }, [""], keepGoing, "exact")

  expect(result).toMatchObject({ succeeded: true, refreshed: [{ folder: "", settled: false }] })
})

test("leaves a folder that failed out of the refreshed list", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))
  await putNoteFile(vault, "b", "Note", renderNote(aNote()))
  const blocked = join(vault, "a", "index.md")
  await writeFile(blocked, "STALE")
  const release = await blockWrite(blocked)

  try {
    const result = await refreshFolders({ path: vault, name: "Memory", limits }, ["a", "b"], keepGoing, "exact")

    expect(result).toMatchObject({ succeeded: false, refreshed: [{ folder: "b" }] })
    expect(result.refreshed).toHaveLength(1)
  } finally {
    await release()
  }
})

test("lists only the folders refreshed before the continuation probe stopped the pass", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))
  await putNoteFile(vault, "b", "Note", renderNote(aNote()))

  const result = await refreshFolders({ path: vault, name: "Memory", limits }, ["a", "b"], allowing(2), "exact")

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted" })
  expect(result.refreshed).toEqual([{ folder: "a", index: await indexStatOnDisk(vault, "a"), settled: true }])
})

test("refreshes exactly the listed folders and leaves their ancestors untouched", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a/b", "Note", renderNote(aNote()))
  const context = { path: vault, name: "Memory", limits }

  const exact = await refreshFolders(context, ["a/b"], keepGoing, "exact")

  expect(exact).toMatchObject({ succeeded: true, refreshed: [{ folder: "a/b" }] })
  expect(exact.refreshed).toHaveLength(1)
  await expect(stat(join(vault, "index.md"))).rejects.toMatchObject({ code: "ENOENT" })
  await expect(stat(join(vault, "a", "index.md"))).rejects.toMatchObject({ code: "ENOENT" })
  await expect(stat(join(vault, "a", "b", "index.md"))).resolves.toBeDefined()

  const expanded = await refreshFolders(context, ["a/b"], keepGoing, "with-ancestors")

  expect(expanded.refreshed.map((entry) => entry.folder).sort()).toEqual(["", "a", "a/b"])
  await expect(stat(join(vault, "index.md"))).resolves.toBeDefined()
})

test("does not settle a folder whose note file name cannot be resolved", async (context) => {
  if (process.platform !== "win32") context.skip("reserved file names are only checked on Windows")
  const vault = await useTempFolder()
  const reserved = `\\\\?\\${vault}\\CON.md`
  await writeFile(reserved, renderNote(aNote()))

  try {
    const result = await refreshFolders({ path: vault, name: "Memory", limits }, [""], keepGoing, "exact")

    expect(result).toMatchObject({ succeeded: true, refreshed: [{ folder: "", settled: false }] })
  } finally {
    await rm(reserved)
  }
})
