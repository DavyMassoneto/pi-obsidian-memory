import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { noSessionResponse } from "#src/pi"
import {
  noteWithId,
  READIED_PATH as path,
  piMemoryFixture,
  putCatalogFile,
  readiedPiNote,
  textOf,
  updateResponse,
  writeAgentConfig,
} from "#test-helpers"

test("after memory_get the note is updated and the answer says where", async () => {
  const fixture = await readiedPiNote()

  const response = await updateResponse(fixture, {
    vault: "global",
    path,
    body: "Always pnpm, in CI too.",
    type: "fact",
  })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(`Updated in global: ${path}`)
  const text = await readFile(fixture.file, "utf8")
  expect(text).toContain("Always pnpm, in CI too.")
  expect(text).toContain("type: fact")
})

test("a note that was not read is an error and stays as it was", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, path, noteWithId(1, "Always pnpm.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await updateResponse(fixture, { vault: "global", path, body: "Changed." })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain(path)
})

test("an update the vault refuses is an error that names the problem", async () => {
  const fixture = await readiedPiNote()

  const response = await updateResponse(fixture, { vault: "global", path, body: "" })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain("- ")
  expect(await readFile(fixture.file, "utf8")).toContain("Always pnpm.")
})

test("a config edited by hand after the read is an error and the note stays as it was", async () => {
  const fixture = await readiedPiNote()
  const limits = { ...fixture.config.limits, maxBodyChars: 900 }
  await writeAgentConfig(fixture.configPath, JSON.stringify({ ...fixture.config, limits }))

  const response = await updateResponse(fixture, { vault: "global", path, body: "Changed." })

  expect(response.isError).toBe(true)
  expect(await readFile(fixture.file, "utf8")).toContain("Always pnpm.")
})

test("before any session started the tool says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await updateResponse(fixture, { vault: "global", path, body: "Changed." })

  expect(response.isError).toBe(true)
  expect(response).toEqual(noSessionResponse())
})
