import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { refreshFolders } from "#src/services"
import {
  aLimits,
  allowing,
  aNote,
  blockWrite,
  keepGoing,
  linkFolder,
  putNoteFile,
  readIndexOf,
  tryLinkFile,
  useTempFolder,
} from "#test-helpers"

const limits = aLimits()

test("refreshes the other folders when a folder name is not representable as a link", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "c#", "Note", renderNote(aNote()))
  await putNoteFile(vault, "topic", "Note", renderNote(aNote()))

  const result = await refreshFolders(
    { path: vault, name: "Memory", limits },
    ["c#", "topic"],
    keepGoing,
    "with-ancestors",
  )

  expect(result).toMatchObject({ succeeded: false, reason: "invalid", problems: [expect.stringContaining("c#")] })
  expect(await readIndexOf(vault, "topic")).toContain("## Notes")
  expect(await readIndexOf(vault, "")).toContain("- [[topic/index|topic]]")
  expect(await readIndexOf(vault, "")).toContain("## Needs fixing")
  expect(await readIndexOf(vault, "")).toContain("Folder `c#`")
  expect(await readdir(join(vault, "c#"))).toEqual(["Note.md"])
})

test("refreshes the remaining folders after one index cannot be written", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))
  await putNoteFile(vault, "b", "Note", renderNote(aNote()))
  const blocked = join(vault, "a", "index.md")
  await writeFile(blocked, "STALE")
  const release = await blockWrite(blocked)

  try {
    const result = await refreshFolders(
      { path: vault, name: "Memory", limits },
      ["a", "b"],
      keepGoing,
      "with-ancestors",
    )

    expect(result).toMatchObject({ succeeded: false, problems: [expect.stringContaining("a/index")] })
    expect(await readFile(blocked, "utf8")).toBe("STALE")
  } finally {
    await release()
  }
  expect(await readIndexOf(vault, "b")).toContain("## Notes")
  expect(await readIndexOf(vault, "")).toContain("- [[b/index|b]]")
})

test("keeps refreshing other folders after the root index is refused as an alias to a note", async (context) => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "Note.md"), renderNote(aNote()))
  await putNoteFile(vault, "topic", "Note", renderNote(aNote()))
  if (!(await tryLinkFile(join(vault, "Note.md"), join(vault, "index.md"))))
    context.skip("this system cannot create file links")

  expect(
    await refreshFolders({ path: vault, name: "Memory", limits }, ["", "topic"], keepGoing, "with-ancestors"),
  ).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readIndexOf(vault, "topic")).toContain("## Notes")
})

test("stops writing indexes as soon as the continuation probe says stop", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))
  await putNoteFile(vault, "b", "Note", renderNote(aNote()))

  const result = await refreshFolders(
    { path: vault, name: "Memory", limits },
    ["a", "b"],
    allowing(2),
    "with-ancestors",
  )

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted" })
  expect(await readdir(vault)).toEqual(["a", "b"])
  expect(await readdir(join(vault, "b"))).toEqual(["Note.md"])
  expect((await readdir(join(vault, "a"))).sort()).toEqual(["Note.md", "index.md"])
})

test("does not write a folder's index when the stop arrives while its notes are being read", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "a", "Note", renderNote(aNote()))

  const result = await refreshFolders({ path: vault, name: "Memory", limits }, ["a"], allowing(1), "with-ancestors")

  expect(result).toMatchObject({ succeeded: false, reason: "interrupted" })
  expect(await readdir(vault)).toEqual(["a"])
  expect(await readdir(join(vault, "a"))).toEqual(["Note.md"])
})

test("writes nothing through a logical alias whose physical target is not representable as a link", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "c#", "Note", renderNote(aNote()))
  await putNoteFile(vault, "topic", "Note", renderNote(aNote()))
  await linkFolder(join(vault, "c#"), join(vault, "alias"))

  const result = await refreshFolders(
    { path: vault, name: "Memory", limits },
    ["alias", "topic"],
    keepGoing,
    "with-ancestors",
  )

  expect(result).toMatchObject({ succeeded: false, reason: "invalid", problems: [expect.stringContaining("c#")] })
  expect(await readdir(join(vault, "c#"))).toEqual(["Note.md"])
  expect(await readdir(join(vault, "topic"))).toContain("index.md")
  const root = await readIndexOf(vault, "")
  expect(root).toContain("- [[topic/index|topic]]")
  expect(root).toContain("Folder `c#`")
})
