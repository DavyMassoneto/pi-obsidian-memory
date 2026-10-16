import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  archiveResponse,
  noteWithId,
  READIED_PATH as path,
  piMemoryFixture,
  putCatalogFile,
  readiedPiNote,
  readText,
  textOf,
} from "#test-helpers"

test("after memory_get the note is archived and the answer gives the archive path", async () => {
  const fixture = await readiedPiNote()

  const response = await archiveResponse(fixture, { vault: "global", path })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe("Archived in global: archive/tools/Use pnpm.md")
  expect(await readFile(join(fixture.vaults.global.path, "archive/tools/Use pnpm.md"), "utf8")).toContain("archived:")
})

test("a note that was not read is an error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, path, noteWithId(1, "Always pnpm.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await archiveResponse(fixture, { vault: "global", path })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain(path)
})

test("an archive/ path is an error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "archive/Old.md", noteWithId(2, "Old.", ["archived: 2026-10-01"]))
  await fixture.pi.startSession(fixture.piContext, "startup")
  await readText(fixture, { vault: "global", path: "archive/Old.md" })

  const response = await archiveResponse(fixture, { vault: "global", path: "archive/Old.md" })

  expect(response.isError).toBe(true)
})

test("when the archive name is taken the answer is an error and nothing moves", async () => {
  const fixture = await readiedPiNote()
  await putCatalogFile(
    fixture.vaults.global,
    "archive/tools/Use pnpm.md",
    noteWithId(9, "Older.", ["archived: 2026-01-01"]),
  )

  const response = await archiveResponse(fixture, { vault: "global", path })

  expect(response.isError).toBe(true)
  expect(await readFile(fixture.file, "utf8")).toContain("Always pnpm.")
})

test("before any session started the tool says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await archiveResponse(fixture, { vault: "global", path })

  expect(textOf(response)).toContain("Memory is not ready")
})
