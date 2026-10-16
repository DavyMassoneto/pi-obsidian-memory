import { expect, test } from "vitest"

import {
  noteWithId,
  piGlobalOnlyFixture,
  piMemoryFixture,
  piUnconfiguredFixture,
  putCatalogFile,
  searchedText,
  searchResponse,
  textOf,
  writeAgentConfig,
} from "#test-helpers"

test("lists each hit with its vault, path, type and marks, grouped by vault", async () => {
  const fixture = await piMemoryFixture()
  const { vaults, pi, piContext } = fixture
  await putCatalogFile(vaults.global, "typescript/No ternaries.md", noteWithId(1, "pnpm rule", ["dontForget: true"]))
  await putCatalogFile(vaults.global, "Long.md", noteWithId(2, "pnpm ".repeat(300), []))
  await putCatalogFile(vaults.project, "Deploy.md", noteWithId(3, "pnpm deploy", []))
  await pi.startSession(piContext, "startup")

  const text = await searchedText(fixture, { query: "pnpm", vault: "both" })

  expect(text.split("\n")).toEqual(
    expect.arrayContaining([
      "global · typescript/No ternaries.md · rule · don't forget",
      "global · Long.md · rule · needs fixing",
      "project · Deploy.md · rule",
    ]),
  )
})

test("says how to read on when nothing is found", async () => {
  const fixture = await piMemoryFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  expect(await searchedText(fixture, { query: "nothing", vault: "both" })).toBe(
    'No notes found in global, project. Try other words or walk folders with memory_get (path "" is the vault root).',
  )
})

test("a folder without a registered project says so", async () => {
  const fixture = await piGlobalOnlyFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  expect(await searchedText(fixture, { query: "x", vault: "both" })).toContain(
    "No project vault is registered for this folder.",
  )
})

test("without a config the search is an error that points to /memory-setup", async () => {
  const fixture = await piUnconfiguredFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  expect(await searchedText(fixture, { query: "x", vault: "global" })).toContain("/memory-setup")
})

test("a search that no vault answered is an error", async () => {
  const fixture = await piGlobalOnlyFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await searchResponse(fixture, { query: "x", vault: "project" })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("No project vault is registered for this folder.")
})

test("a search before any session started says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await searchResponse(fixture, { query: "x", vault: "global" })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain("Memory is not ready")
})

test("a config edited by hand during the session does not surface a stale-session error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "Use pnpm.md", noteWithId(1, "pnpm rule", []))
  await fixture.pi.startSession(fixture.piContext, "startup")
  await searchedText(fixture, { query: "pnpm", vault: "global" })
  const limits = { ...fixture.config.limits, maxBodyChars: 900 }
  await writeAgentConfig(fixture.configPath, JSON.stringify({ ...fixture.config, limits }))

  const response = await searchResponse(fixture, { query: "pnpm", vault: "global" })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe("global · Use pnpm.md · rule")
})
