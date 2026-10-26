import { join } from "node:path"

import { expect, test } from "vitest"

import { readOmMemory } from "#src/services"
import { folderSnapshot, OM_LAYOUT_FILES, OM_LAYOUT_SOURCES, useTempFolder, writeProjectFiles } from "#test-helpers"

test("topic files and JOURNEY.md of each session folder and flat topic files are read, sorted by path, INDEX.md, dot folders and other files are skipped", async () => {
  const project = await useTempFolder()
  await writeProjectFiles(project, OM_LAYOUT_FILES)

  expect(await readOmMemory(project)).toEqual({ succeeded: true, output: OM_LAYOUT_SOURCES })
})

test("a missing .memory folder gives no sources", async () => {
  const project = await useTempFolder()

  expect(await readOmMemory(project)).toEqual({ succeeded: true, output: [] })
  expect(await folderSnapshot(project)).toEqual([])
})

test("a .memory that is a file is refused with its path, reading nothing", async () => {
  const project = await useTempFolder()
  await writeProjectFiles(project, [{ path: ".memory", text: "not a folder" }])

  const result = await readOmMemory(project)

  expect(result).toEqual({
    succeeded: false,
    reason: "io-error",
    problems: [`${join(project, ".memory")} cannot be read (ENOTDIR)`],
  })
})

test("reading changes nothing on disk", async () => {
  const project = await useTempFolder()
  await writeProjectFiles(project, OM_LAYOUT_FILES)
  const before = await folderSnapshot(project)

  await readOmMemory(project)

  expect(await folderSnapshot(project)).toEqual(before)
})

test("CRLF text is returned as written", async () => {
  const project = await useTempFolder()
  const text = "---\r\nname: beamer\r\n---\r\nline one\r\nline two\r\n"
  await writeProjectFiles(project, [{ path: ".memory/2026-abc/beamer-kvm.md", text }])

  expect(await readOmMemory(project)).toEqual({
    succeeded: true,
    output: [{ path: ".memory/2026-abc/beamer-kvm.md", text }],
  })
})
