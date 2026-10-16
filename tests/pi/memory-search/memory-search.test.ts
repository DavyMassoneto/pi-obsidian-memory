import { expect, test } from "vitest"

import { noSessionResponse } from "#src/pi"
import {
  noteWithId,
  piMemoryFixture,
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

test("a search before any session started says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await searchResponse(fixture, { query: "x", vault: "global" })

  expect(response.isError).toBe(true)
  expect(response).toEqual(noSessionResponse())
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
  expect(textOf(response).split("\n")[0]).toBe("global · Use pnpm.md · rule")
})
