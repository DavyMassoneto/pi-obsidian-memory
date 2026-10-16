import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { noSessionResponse } from "#src/pi"
import {
  noteWithId,
  READIED_PATH as path,
  piMemoryFixture,
  putCatalogFile,
  readiedPiNote,
  succeedResponse,
  textOf,
} from "#test-helpers"

const replacement = {
  vault: "global",
  path,
  folder: "tools",
  statement: "Use bun, never pnpm",
  type: "decision",
  body: "Bun is the runner now.",
  dontForget: false,
} as const

test("after memory_get the note is replaced and the answer gives the archive and the new note", async () => {
  const fixture = await readiedPiNote()

  const response = await succeedResponse(fixture, replacement)

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe("Replaced in global: archive/tools/Use pnpm.md; new note: tools/Use bun, never pnpm.md")
  expect(await readFile(join(fixture.vaults.global.path, "tools/Use bun, never pnpm.md"), "utf8")).toContain(
    "Bun is the runner now.",
  )
})

test("a note that was not read is an error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, path, noteWithId(1, "Always pnpm.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await succeedResponse(fixture, replacement)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain(path)
})

test("a taken successor name is an error and nothing is published", async () => {
  const fixture = await readiedPiNote()
  await putCatalogFile(fixture.vaults.global, "tools/Use bun, never pnpm.md", noteWithId(2, "Already.", []))

  const response = await succeedResponse(fixture, replacement)

  expect(response.isError).toBe(true)
  expect(await readFile(fixture.file, "utf8")).toContain("Always pnpm.")
})

test.runIf(process.platform === "win32")("on Windows: a partly done replacement is an error that says so", async () => {
  const fixture = await readiedPiNote()

  const response = await succeedResponse(fixture, { ...replacement, folder: "a".repeat(256) })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain("Partly done")
})

test("before any session started the tool says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await succeedResponse(fixture, replacement)

  expect(response).toEqual(noSessionResponse())
})
