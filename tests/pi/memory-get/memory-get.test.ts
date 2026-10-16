import { expect, test } from "vitest"

import { noSessionResponse } from "#src/pi"
import {
  noteWithId,
  piMemoryFixture,
  piUnconfiguredFixture,
  putCatalogFile,
  readText,
  searchedText,
  textOf,
  writeAgentConfig,
} from "#test-helpers"

test("a note comes back in full with the vault and path first", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await readText(fixture, { vault: "global", path: "tools/Use pnpm.md" })

  expect(response.isError).toBe(false)
  expect(textOf(response).split("\n")[0]).toBe("global · tools/Use pnpm.md")
  expect(textOf(response)).toContain("Always pnpm.")
  expect(textOf(response)).not.toContain("Needs fixing:")
})

test("a note with an unknown field and a body over a lowered limit returns its content with every problem", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "Odd.md", noteWithId(1, "x".repeat(1200), ["colour: red"]))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const text = textOf(await readText(fixture, { vault: "global", path: "Odd.md" }))

  expect(text).toContain("colour: red")
  expect(text).toContain("Needs fixing:")
  expect(text).toContain("colour")
  expect(text).toContain("body")
})

test("a folder returns its index, the root is the empty path and archive paths are readable", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await putCatalogFile(fixture.vaults.global, "archive/Old.md", noteWithId(2, "Old news.", []))
  await fixture.pi.startSession(fixture.piContext, "startup")

  const folder = await readText(fixture, { vault: "global", path: "tools" })
  const root = await readText(fixture, { vault: "global", path: "" })
  const archived = await readText(fixture, { vault: "global", path: "archive/Old.md" })

  expect(textOf(folder)).toContain("Use pnpm")
  expect(textOf(root)).toContain("tools")
  expect(textOf(archived)).toContain("Old news.")
  expect([folder.isError, root.isError, archived.isError]).toEqual([false, false, false])
})

test("a missing path is refused as an error", async () => {
  const fixture = await piMemoryFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await readText(fixture, { vault: "global", path: "Nope.md" })

  expect(response.isError).toBe(true)
})

test("without a registered project the project vault is refused", async () => {
  const fixture = await piMemoryFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await readText({ ...fixture, workingFolder: fixture.root }, { vault: "project", path: "" })

  expect(response.isError).toBe(true)
})

test("without a config the read is an error", async () => {
  const fixture = await piUnconfiguredFixture()
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await readText(fixture, { vault: "global", path: "" })

  expect(response.isError).toBe(true)
})

test("a note found by memory_search is read in full with memory_get", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(
    fixture.vaults.project,
    "deploy/Deploy on Friday.md",
    noteWithId(1, "Deploy at noon, after the freeze.", []),
  )
  await fixture.pi.startSession(fixture.piContext, "startup")

  const found = await searchedText(fixture, { query: "freeze", vault: "both" })
  const [vault, path] = found.split(" · ")
  if ((vault !== "project" && vault !== "global") || typeof path !== "string") throw new Error(found)
  const read = await readText(fixture, { vault, path })

  expect(found).toBe("project · deploy/Deploy on Friday.md · rule")
  expect(read.isError).toBe(false)
  expect(textOf(read)).toContain("Deploy at noon, after the freeze.")
  expect(textOf(read)).toContain("id: 01JABCDE7XKQ2M9V3RTN8WPZ01")
})

test("a file with no closed frontmatter block is refused as an error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "Blank.md", "just text, no frontmatter")
  await fixture.pi.startSession(fixture.piContext, "startup")

  const response = await readText(fixture, { vault: "global", path: "Blank.md" })

  expect(response.isError).toBe(true)
})

test("a read before any session started says memory is not ready", async () => {
  const fixture = await piMemoryFixture()

  const response = await readText(fixture, { vault: "global", path: "" })

  expect(response.isError).toBe(true)
  expect(response).toEqual(noSessionResponse())
})

test("a config edited by hand during the session does not surface a stale-session error", async () => {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "Use pnpm.md", noteWithId(1, "pnpm rule", []))
  await fixture.pi.startSession(fixture.piContext, "startup")
  await readText(fixture, { vault: "global", path: "Use pnpm.md" })
  const limits = { ...fixture.config.limits, maxBodyChars: 900 }
  await writeAgentConfig(fixture.configPath, JSON.stringify({ ...fixture.config, limits }))

  const response = await readText(fixture, { vault: "global", path: "Use pnpm.md" })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toContain("pnpm rule")
})
