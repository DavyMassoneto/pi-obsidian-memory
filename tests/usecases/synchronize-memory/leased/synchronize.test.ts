import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import { type SynchronizeMemoryRequest, synchronizeMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  holdIndexLock,
  memoryReadFixture,
  memoryReadTree,
  noteText,
  putCatalogFile,
  synchronizedCatalog,
  synchronizedIndexPath,
  tryLinkFile,
  validFrontmatterLines,
} from "#test-helpers"

test.each(["cancelled", "stale", "invalid", "infrastructure"])(
  "%s authority does no index or vault work",
  async (kind) => {
    const { vault, context, config, controller, root } = await memoryReadFixture()
    if (kind === "cancelled") controller.abort()
    if (kind === "stale") context.session.invalidate(context.stamp)
    if (kind === "invalid") await writeFile(context.configPath, "{}")
    if (kind === "infrastructure") context.indexPath = config.global.vault
    const before = await memoryReadTree(root)
    expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(false)
    expect(await memoryReadTree(root)).toEqual(before)
    expect(await readdir(vault.path)).toEqual([])
    await expectRegistrationLeaseReleased(context)
  },
)

test("captures request and paths before waiting for a lease", async () => {
  const { vault, context, root } = await memoryReadFixture()
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) throw new Error("lease required")
  const request: SynchronizeMemoryRequest = { vault: "global" }
  const pending = synchronizeMemory(request, context)
  request.vault = "project"
  context.configPath = root
  context.indexPath = vault.path
  lease.release()
  expect(await pending).toMatchObject({ succeeded: true, output: { vault: "global" } })
  expect(await readdir(vault.path)).toEqual(["index.md"])
})

test("cancellation during first configuration await never creates an index or folder index", async () => {
  const { context, controller, root } = await memoryReadFixture()
  const before = await memoryReadTree(root)
  const pending = synchronizeMemory({ vault: "global" }, context)
  await Promise.resolve()
  controller.abort()
  expect(await pending).toMatchObject({ succeeded: false, reason: "cancelled" })
  expect(await memoryReadTree(root)).toEqual(before)
  await expectRegistrationLeaseReleased(context)
})

test("busy database is preserved and the lease is released", async () => {
  const { vault, context } = await memoryReadFixture()
  await synchronizeMemory({ vault: "global" }, context)
  const path = await synchronizedIndexPath(context, vault.path)
  const before = await readFile(path)
  const release = holdIndexLock(path, "write")
  try {
    expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
      succeeded: false,
      reason: "unavailable",
    })
  } finally {
    release()
  }
  expect(await readFile(path)).toEqual(before)
  expect(await readdir(dirname(path))).toHaveLength(1)
  await expectRegistrationLeaseReleased(context)
})

test("unavailable database leaves its occupied path untouched", async () => {
  const { vault, context } = await memoryReadFixture()
  const path = await synchronizedIndexPath(context, vault.path)
  await mkdir(path, { recursive: true })
  const before = await memoryReadTree(dirname(path))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "unavailable",
  })
  expect(await memoryReadTree(dirname(path))).toEqual(before)
  await expectRegistrationLeaseReleased(context)
})

test("folder maintenance failure retains committed catalog and untouched note bytes", async () => {
  const { vault, context } = await memoryReadFixture()
  const text = noteText(validFrontmatterLines(), "memory")
  await putCatalogFile(vault, "Note.md", text)
  await mkdir(`${vault.path}/index.md`)
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({ succeeded: true, output: { committed: true, population: "ready" } })
  if (!result.succeeded) throw new Error("sync required")
  expect(result.output.warnings.length).toBeGreaterThan(0)
  expect(await readFile(`${vault.path}/Note.md`, "utf8")).toBe(text)
  await expectRegistrationLeaseReleased(context)
})

test("refuses maintenance through an index alias to a note after truthfully committing the catalog", async (testContext) => {
  const { vault, context } = await memoryReadFixture()
  const text = noteText(validFrontmatterLines(), "memory")
  await putCatalogFile(vault, "Note.md", text)
  if (!(await tryLinkFile(`${vault.path}/Note.md`, `${vault.path}/index.md`))) testContext.skip()
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { committed: true, warnings: [expect.stringContaining("index.md")] },
  })
  expect(await readFile(`${vault.path}/Note.md`, "utf8")).toBe(text)
  expect(synchronizedCatalog(await synchronizedIndexPath(context, vault.path)).hits).toHaveLength(1)
})

test("frontmatter archives outside archive keep valid identity and duplicate reporting but never search", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Active.md", noteText(validFrontmatterLines(), "memory active"))
  await putCatalogFile(
    vault,
    "Retired.md",
    noteText([...validFrontmatterLines(), "archived: 2026-10-05"], "memory retired"),
  )
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { duplicateIds: [{ paths: ["Active.md", "Retired.md"] }] },
  })
  const { inventory, hits } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(inventory.entries.find((entry) => entry.path === "Retired.md")).toMatchObject({
    note: { id: "01JABCDE7XKQ2M9V3RTN8WPZ5F", archived: true },
    needsFixing: false,
  })
  expect(hits.map((hit) => hit.path)).toEqual(["Active.md"])
})

test("valid frontmatter with bad name or empty body remains searchable and needs fixing", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "[bad].md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "Memory empty.md", noteText(validFrontmatterLines(), ""))
  await synchronizeMemory({ vault: "global" }, context)
  const { hits } = synchronizedCatalog(await synchronizedIndexPath(context, vault.path))
  expect(hits.map((hit) => hit.path).sort()).toEqual(["Memory empty.md", "[bad].md"])
  expect(hits.every((hit) => hit.needsFixing)).toBe(true)
})
