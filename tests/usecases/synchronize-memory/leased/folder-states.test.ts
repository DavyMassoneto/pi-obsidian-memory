import { readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#src/usecases"
import {
  garbleKeepingStat,
  noteText,
  putCatalogFile,
  twoFolderFixture,
  validFrontmatterLines,
  whileLocked,
} from "#test-helpers"

const marked = [...validFrontmatterLines(), "dontForget: true"]
const windowsOnly = process.platform !== "win32"

test.skipIf(windowsOnly)(
  "on Windows: a folder whose listing and index stat are unchanged is not rendered again",
  async () => {
    const { vault, context } = await twoFolderFixture()
    const before = await readFile(join(vault.path, "a/index.md"), "utf8")
    const result = await whileLocked(join(vault.path, "a/Note.md"), () =>
      synchronizeMemory({ vault: "global" }, context),
    )
    expect(result).toMatchObject({ succeeded: true, output: { warnings: [] } })
    expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toBe(before)
  },
)

test.skipIf(windowsOnly)("on Windows: editing one note renders only its folder", async () => {
  const { vault, context } = await twoFolderFixture()
  const sibling = await readFile(join(vault.path, "b/index.md"), "utf8")
  await putCatalogFile(vault, "a/Note.md", noteText(marked, "memory"))
  const result = await whileLocked(join(vault.path, "b/Note.md"), () => synchronizeMemory({ vault: "global" }, context))
  expect(result).toMatchObject({ succeeded: true, output: { warnings: [] } })
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toContain("don't forget")
  expect(await readFile(join(vault.path, "b/index.md"), "utf8")).toBe(sibling)
})

test.skipIf(windowsOnly)(
  "on Windows: removing a subfolder fixes the parent index and leaves a clean sibling alone",
  async () => {
    const { vault, context } = await twoFolderFixture()
    const sibling = await readFile(join(vault.path, "a/index.md"), "utf8")
    await rm(join(vault.path, "b"), { recursive: true })
    const result = await whileLocked(join(vault.path, "a/Note.md"), () =>
      synchronizeMemory({ vault: "global" }, context),
    )
    expect(result).toMatchObject({ succeeded: true, output: { warnings: [] } })
    expect(await readFile(join(vault.path, "index.md"), "utf8")).not.toContain("b/index")
    expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toBe(sibling)
  },
)

test("a hand-edited folder index is rendered again", async () => {
  const { vault, context } = await twoFolderFixture()
  const before = await readFile(join(vault.path, "a/index.md"), "utf8")
  await writeFile(join(vault.path, "a/index.md"), "edited by hand, longer than the rendered text")
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toBe(before)
})

test("a same-size edit with the mtime restored is rendered again", async () => {
  const { vault, context } = await twoFolderFixture()
  const before = await readFile(join(vault.path, "a/index.md"), "utf8")
  await garbleKeepingStat(join(vault.path, "a/index.md"))
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toBe(before)
})

test.skipIf(windowsOnly)(
  "on Windows: a folder rendered while a note was unreadable is rendered again once it reads",
  async () => {
    const { vault, context } = await twoFolderFixture()
    await putCatalogFile(vault, "a/Note.md", noteText(marked, "memory"))
    await whileLocked(join(vault.path, "a/Note.md"), async () => {
      await synchronizeMemory({ vault: "global" }, context)
      expect(await readFile(join(vault.path, "a/index.md"), "utf8")).not.toContain("don't forget")
    })
    expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
    expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toContain("don't forget")
  },
)
