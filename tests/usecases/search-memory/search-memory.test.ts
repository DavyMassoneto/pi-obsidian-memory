import { mkdir, readFile, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { addMemory, createMemorySession, searchMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteText,
  noteWithId,
  putCatalogFile,
  searchedHits,
  searchFixture,
  synchronizedIndexPath,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a note created, edited, moved and deleted on disk is found, updated or gone in the next search", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "tools/Edit.md", noteWithId(1, "pnpm original", []))
  await putCatalogFile(vault, "tools/Move.md", noteWithId(2, "pnpm moving", []))
  await putCatalogFile(vault, "tools/Delete.md", noteWithId(3, "pnpm deleted", []))

  const first = await searchMemory({ query: "pnpm", vault: "global" }, context)
  expect(first).toMatchObject({ succeeded: true, output: { projectMissing: false } })
  expect(
    searchedHits(first, "global")
      .map((hit) => hit.path)
      .sort(),
  ).toEqual(["tools/Delete.md", "tools/Edit.md", "tools/Move.md"])

  await putCatalogFile(vault, "tools/Edit.md", noteWithId(1, "yarn replaced", []))
  await mkdir(join(vault.path, "moved"))
  await rename(join(vault.path, "tools/Move.md"), join(vault.path, "moved/Moved.md"))
  await rm(join(vault.path, "tools/Delete.md"))
  await putCatalogFile(vault, "tools/Created.md", noteWithId(4, "pnpm created", []))

  const pnpm = await searchMemory({ query: "pnpm", vault: "global" }, context)
  const yarn = await searchMemory({ query: "yarn", vault: "global" }, context)
  expect(pnpm).toMatchObject({
    succeeded: true,
    output: { vaults: [{ vault: "global", hits: expect.any(Array), warnings: [] }] },
  })
  expect(
    searchedHits(pnpm, "global")
      .map((hit) => hit.path)
      .sort(),
  ).toEqual(["moved/Moved.md", "tools/Created.md"])
  expect(yarn).toMatchObject({ succeeded: true, output: { vaults: [{ hits: [{ path: "tools/Edit.md" }] }] } })
  await expectRegistrationLeaseReleased(context)
})

test("deleting the index gives the same results", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "pnpm everywhere", []))
  await putCatalogFile(vault, "Other.md", noteWithId(2, "pnpm elsewhere", []))
  const before = await searchMemory({ query: "pnpm", vault: "global" }, context)

  await rm(await synchronizedIndexPath(context, vault.path), { force: true })
  const after = await searchMemory({ query: "pnpm", vault: "global" }, context)

  expect(before).toMatchObject({ succeeded: true, output: { vaults: [{ hits: expect.any(Array) }] } })
  expect(after).toEqual(before)
})

test("a blank note and a note with an unknown frontmatter field stay out of search and are listed under Needs fixing", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "Good.md", noteWithId(1, "pnpm good", []))
  await putCatalogFile(vault, "Blank.md", "")
  await putCatalogFile(vault, "Unknown.md", noteWithId(2, "pnpm unknown", ["colour: red"]))

  const result = await searchMemory({ query: "pnpm", vault: "global" }, context)

  expect(result).toMatchObject({ succeeded: true, output: { vaults: [{ hits: [{ path: "Good.md" }] }] } })
  const index = await readFile(join(vault.path, "index.md"), "utf8")
  expect(index).toContain("Needs fixing")
  expect(index).toContain("Blank")
  expect(index).toContain("Unknown")
})

test("a note with valid frontmatter and a body over a lowered limit is found and marked as needing fixing", async () => {
  const { vault, context, config } = await searchFixture()
  await putCatalogFile(vault, "Long.md", noteWithId(1, "pnpm overlong body text", []))
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, limits: { ...config.limits, maxBodyChars: 10 } }),
  )

  const result = await searchMemory({ query: "overlong", vault: "global" }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: { vaults: [{ hits: [{ path: "Long.md", needsFixing: true }] }] },
  })
})

test("archived notes are not searched", async () => {
  const { vault, context } = await searchFixture()
  await putCatalogFile(vault, "archive/Old.md", noteWithId(1, "pnpm archived", []))
  await putCatalogFile(vault, "Current.md", noteWithId(2, "pnpm current", []))

  const result = await searchMemory({ query: "pnpm", vault: "global" }, context)

  expect(result).toMatchObject({ succeeded: true, output: { vaults: [{ hits: [{ path: "Current.md" }] }] } })
})

test("a note saved with addMemory is found by the next search", async () => {
  const { context } = await searchFixture()
  const added = await addMemory(
    {
      scope: "global",
      folder: "tools",
      draft: { statement: "Use pnpm, never npm", type: "lesson", body: "Always pnpm.", dontForget: true },
    },
    context,
  )
  expect(added.succeeded).toBe(true)

  const result = await searchMemory({ query: "pnpm", vault: "global" }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: { vaults: [{ hits: [{ path: "tools/Use pnpm, never npm.md", type: "lesson", dontForget: true }] }] },
  })
})

test("both vaults are searched separately, each with its own hits", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "pnpm global", []))
  await putCatalogFile(project, "Project.md", noteWithId(2, "pnpm project", []))

  const result = await searchMemory({ query: "pnpm", vault: "both" }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      projectMissing: false,
      vaults: [
        { vault: "global", hits: [{ path: "Global.md" }] },
        { vault: "project", hits: [{ path: "Project.md" }] },
      ],
    },
  })
})

test("each vault returns at most ten results", async () => {
  const { vault, context } = await searchFixture()
  for (let number = 1; number <= 12; number++) {
    await putCatalogFile(vault, `Note ${number}.md`, noteWithId(number, "pnpm many", []))
  }

  const result = await searchMemory({ query: "pnpm", vault: "global" }, context)

  expect(searchedHits(result, "global")).toHaveLength(10)
})

test("a folder without a registered project reports projectMissing and still searches global", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Global.md", noteText(validFrontmatterLines(), "pnpm global"))

  const both = await searchMemory({ query: "pnpm", vault: "both" }, context)
  const project = await searchMemory({ query: "pnpm", vault: "project" }, context)

  expect(both).toMatchObject({
    succeeded: true,
    output: { projectMissing: true, vaults: [{ vault: "global", hits: [{ path: "Global.md" }] }] },
  })
  expect(project).toMatchObject({ succeeded: true, output: { projectMissing: true, vaults: [] } })
})

test("a vault that cannot be searched reports its problems while the other vault still answers", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "pnpm global", []))
  await rm(project.path, { recursive: true })

  const result = await searchMemory({ query: "pnpm", vault: "both" }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      vaults: [
        { vault: "global", hits: [{ path: "Global.md" }] },
        { vault: "project", problems: [expect.any(String)] },
      ],
    },
  })
})

test("without a config the search is refused and the lease is released", async () => {
  const { context } = await searchFixture()
  await rm(context.configPath)

  const result = await searchMemory({ query: "pnpm", vault: "both" }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "not-configured" })
  await expectRegistrationLeaseReleased(context)
})

test("a stale session is refused without searching", async () => {
  const { context } = await searchFixture()
  const other = createMemorySession({ sessionId: "other", branchId: null })

  const result = await searchMemory({ query: "pnpm", vault: "global" }, { ...context, session: other })

  expect(result).toMatchObject({ succeeded: false })
})
