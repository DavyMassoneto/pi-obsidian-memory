import { Value } from "typebox/value"
import { expect, test } from "vitest"

import { ObservationSchema } from "#src/domain"
import { observeGet, observeList, observeRead, observeSearch, synchronizeMemory } from "#src/usecases"
import { captureFixture, noteWithId, putCatalogFile } from "#test-helpers"

test("a note that was read becomes a read observation with its id, hash, text, type and mark", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", ["dontForget: true"]))

  const read = await observeRead({ vault: "global", path: "tools/Use pnpm.md" }, context)

  expect(read).toMatchObject({
    kind: "read",
    vault: "global",
    path: "tools/Use pnpm.md",
    id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
    hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    statement: "Use pnpm",
    body: "Always pnpm.",
    type: "rule",
    dontForget: true,
  })
})

test("a missing note, a folder and a note with invalid frontmatter are unavailable, each with its reason", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Odd.md", noteWithId(2, "Odd.", ["colour: red"]))

  expect(await observeRead({ vault: "global", path: "tools/Missing.md" }, context)).toEqual(expect.any(String))
  expect(await observeRead({ vault: "global", path: "tools" }, context)).toEqual(expect.any(String))
  expect(await observeRead({ vault: "global", path: "tools/Odd.md" }, context)).toContain("invalid frontmatter")
})

test("a get that fails is an unavailable observation for the model", async () => {
  const { context } = await captureFixture()

  expect(await observeGet({ vault: "global", path: "nope.md" }, context)).toMatchObject({
    kind: "unavailable",
    operation: "get",
  })
})

test("a search gives candidates with vault, path, id and statement, at most the limit", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "a/Use pnpm.md", noteWithId(1, "pnpm here", []))
  await putCatalogFile(vault, "b/Prefer pnpm.md", noteWithId(2, "pnpm there", []))

  const all = await observeSearch("global", "pnpm", 5, context)
  const one = await observeSearch("global", "pnpm", 1, context)

  expect(all).toMatchObject({ kind: "search", query: "pnpm", candidates: [expect.anything(), expect.anything()] })
  expect(all).toMatchObject({
    candidates: [{ vault: "global", id: expect.stringMatching(/^[0-9A-Z]{26}$/) }, expect.anything()],
  })
  expect(one).toMatchObject({ kind: "search", candidates: [expect.anything()] })
})

test("a search of a vault that is not registered is unavailable", async () => {
  const { context, root } = await captureFixture()

  expect(await observeSearch("project", "pnpm", 5, { ...context, workingFolder: root })).toMatchObject({
    kind: "unavailable",
    operation: "search",
  })
})

test("a folder listing gives its subfolders, and its notes with path, type, statement and mark but no id", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", ["dontForget: true"]))
  await putCatalogFile(vault, "tools/Prefer tabs.md", noteWithId(2, "Tabs.", []))
  await putCatalogFile(vault, "tools/deep/Deploy.md", noteWithId(3, "Deploy.", []))
  await synchronizeMemory({ vault: "global" }, context)

  const root = await observeList("global", "", context)
  const tools = await observeList("global", "tools", context)

  expect(root).toEqual({
    kind: "listing",
    vault: "global",
    folder: "",
    folders: ["tools"],
    notes: [],
  })
  expect(tools).toEqual({
    kind: "listing",
    vault: "global",
    folder: "tools",
    folders: ["tools/deep"],
    notes: [
      { vault: "global", path: "tools/Prefer tabs.md", type: "rule", statement: "Prefer tabs" },
      { vault: "global", path: "tools/Use pnpm.md", type: "rule", statement: "Use pnpm", dontForget: true },
    ],
  })
})

test("a folder with no index or a missing vault is an unavailable listing", async () => {
  const { context, root } = await captureFixture()

  expect(await observeList("global", "nowhere", context)).toMatchObject({ kind: "unavailable", operation: "list" })
  expect(await observeList("project", "", { ...context, workingFolder: root })).toMatchObject({
    kind: "unavailable",
    operation: "list",
  })
})

test("a folder with more than twenty subfolders is listed whole, still valid input", async () => {
  const { context, vault } = await captureFixture()
  for (let number = 1; number <= 25; number++) {
    await putCatalogFile(vault, `area ${String(number).padStart(2, "0")}/Note.md`, noteWithId(number, "Body.", []))
  }
  await synchronizeMemory({ vault: "global" }, context)

  const listing = await observeList("global", "", context)

  if (listing.kind !== "listing") throw new Error("not a listing")
  expect(listing.folders).toHaveLength(25)
  expect(Value.Check(ObservationSchema, listing)).toBe(true)
})

test("a note with a body of more than 16000 characters is read whole, still valid input", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Long.md", noteWithId(1, "x".repeat(16001), []))

  const read = await observeGet({ vault: "global", path: "tools/Long.md" }, context)

  expect(read).toMatchObject({ kind: "read", body: "x".repeat(16001) })
  expect(Value.Check(ObservationSchema, read)).toBe(true)
})
