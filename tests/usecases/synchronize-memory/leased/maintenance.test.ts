import { existsSync } from "node:fs"
import { chmod, mkdir, readFile, rm, stat } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { synchronizeMemory } from "#src/usecases"
import {
  abortWhileFileExists,
  corruptFolderIndexRows,
  expectRegistrationLeaseReleased,
  inFreshSession,
  linkFolder,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  synchronizedIndexPath,
  twoFolderFixture,
  validFrontmatterLines,
  whileLocked,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("refreshes affected physical and logical ancestors without rewriting unrelated indexes", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "physical/deep/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "unrelated/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "logical/Other.md", noteText(validFrontmatterLines(), "memory"))
  await linkFolder(join(vault.path, "physical/deep"), join(vault.path, "logical/alias"))
  await synchronizeMemory({ vault: "global" }, context)
  const untouched = await stat(join(vault.path, "unrelated/index.md"))
  await putCatalogFile(
    vault,
    "physical/deep/Note.md",
    noteText([...validFrontmatterLines(), "dontForget: true"], "memory"),
  )
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { warnings: [] },
  })
  expect(await readFile(join(vault.path, "physical/deep/index.md"), "utf8")).toContain("don't forget")
  expect(await readFile(join(vault.path, "logical/index.md"), "utf8")).toContain("alias/index")
  expect(await readFile(join(vault.path, "physical/index.md"), "utf8")).toContain("deep/index")
  expect(await stat(join(vault.path, "unrelated/index.md"))).toMatchObject({
    mtimeMs: untouched.mtimeMs,
    ino: untouched.ino,
  })
})

test("retries failed folder maintenance after the catalog has already committed", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "memory"))
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  const index = join(vault.path, "index.md")
  await chmod(index, 0o444)
  try {
    await putCatalogFile(vault, "Note.md", noteText([...validFrontmatterLines(), "dontForget: true"], "memory"))
    const failed = await synchronizeMemory({ vault: "global" }, context)
    expect(failed).toMatchObject({ succeeded: true, output: { committed: true } })
    if (!failed.succeeded) throw new Error("sync required")
    expect(failed.output.warnings.length).toBeGreaterThan(0)
    expect(await readFile(index, "utf8")).not.toContain("don't forget")
  } finally {
    await chmod(index, 0o666)
  }
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { committed: false, warnings: [] },
  })
  expect(await readFile(index, "utf8")).toContain("don't forget")
})

test("removes a deleted empty folder from the surviving parent index", async () => {
  const { vault, context } = await memoryReadFixture()
  const empty = join(vault.path, "empty")
  await mkdir(empty)
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  expect(await readFile(join(vault.path, "index.md"), "utf8")).toContain("empty/index")
  await rm(empty, { recursive: true })
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: true,
    output: { committed: false, warnings: [] },
  })
  expect(await readFile(join(vault.path, "index.md"), "utf8")).not.toContain("empty/index")
})

test("cancellation after the catalog is published stops further folder index writes and releases the lease", async () => {
  const { vault, context, controller } = await memoryReadFixture()
  await putCatalogFile(vault, "a/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "b/Note.md", noteText(validFrontmatterLines(), "memory"))
  const firstIndex = join(vault.path, "index.md")
  Object.defineProperty(controller.signal, "aborted", { get: () => existsSync(firstIndex) })
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
    succeeded: false,
    reason: "cancelled",
    progress: { committed: true },
  })
  expect(existsSync(firstIndex)).toBe(true)
  expect(existsSync(join(vault.path, "a/index.md"))).toBe(false)
  expect(existsSync(join(vault.path, "b/index.md"))).toBe(false)
  await expectRegistrationLeaseReleased(context)
})

test("a folder whose index cannot be written does not stop the other folders", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "a/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "b/Note.md", noteText(validFrontmatterLines(), "memory"))
  expect((await synchronizeMemory({ vault: "global" }, context)).succeeded).toBe(true)
  const blocked = join(vault.path, "a/index.md")
  await chmod(blocked, 0o444)
  try {
    await putCatalogFile(vault, "a/Note.md", noteText([...validFrontmatterLines(), "dontForget: true"], "memory"))
    await putCatalogFile(vault, "b/Note.md", noteText([...validFrontmatterLines(), "dontForget: true"], "memory"))
    const result = await synchronizeMemory({ vault: "global" }, context)
    expect(result).toMatchObject({ succeeded: true })
    if (!result.succeeded) throw new Error("sync required")
    expect(result.output.warnings.length).toBeGreaterThan(0)
    expect(await readFile(blocked, "utf8")).not.toContain("don't forget")
    expect(await readFile(join(vault.path, "b/index.md"), "utf8")).toContain("don't forget")
  } finally {
    await chmod(blocked, 0o666)
  }
})

test("a folder name the vault path rules refuse does not block the other folder indexes", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "c#/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "topic/Note.md", noteText(validFrontmatterLines(), "memory"))
  const result = await synchronizeMemory({ vault: "global" }, context)
  expect(result).toMatchObject({ succeeded: true, output: { committed: true } })
  if (!result.succeeded) throw new Error("sync required")
  expect(result.output.warnings.length).toBeGreaterThan(0)
  expect(await readFile(join(vault.path, "topic/index.md"), "utf8")).toContain("Note")
  expect(await readFile(join(vault.path, "index.md"), "utf8")).toContain("topic/index")
})

test("folders not reached before cancellation are rendered by the next sync", async () => {
  const { vault, context, controller } = await memoryReadFixture()
  await putCatalogFile(vault, "a/Note.md", noteText(validFrontmatterLines(), "memory"))
  await putCatalogFile(vault, "b/Note.md", noteText(validFrontmatterLines(), "memory"))
  const abort = abortWhileFileExists(controller, join(vault.path, "index.md"))
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({ succeeded: false, reason: "cancelled" })
  abort.disarm()
  expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({ succeeded: true })
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).toContain("Note")
  expect(await readFile(join(vault.path, "b/index.md"), "utf8")).toContain("Note")
})

test.skipIf(process.platform !== "win32")("a lost search index leads to a full folder pass", async () => {
  const { vault, context } = await twoFolderFixture()
  const before = await readFile(join(vault.path, "a/index.md"), "utf8")
  await rm(await synchronizedIndexPath(context, vault.path))
  await whileLocked(join(vault.path, "a/Note.md"), () => synchronizeMemory({ vault: "global" }, context))
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).not.toBe(before)
})

test.skipIf(process.platform !== "win32")("changing the note limits renders every folder again", async () => {
  const { vault, context, config } = await twoFolderFixture()
  const before = await readFile(join(vault.path, "a/index.md"), "utf8")
  const limits = { ...config.limits, maxBodyChars: config.limits.maxBodyChars + 1 }
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, limits }))
  await whileLocked(join(vault.path, "a/Note.md"), () =>
    synchronizeMemory({ vault: "global" }, inFreshSession(context)),
  )
  expect(await readFile(join(vault.path, "a/index.md"), "utf8")).not.toBe(before)
})

test.skipIf(process.platform !== "win32")(
  "a corrupt folder state table is cleared instead of warning on every sync",
  async () => {
    const { vault, context } = await twoFolderFixture()
    corruptFolderIndexRows(await synchronizedIndexPath(context, vault.path))
    const repaired = await whileLocked(join(vault.path, "a/Note.md"), () =>
      synchronizeMemory({ vault: "global" }, context),
    )
    if (!repaired.succeeded) throw new Error("sync required")
    expect(repaired.output.warnings.length).toBeGreaterThan(0)
    expect(await synchronizeMemory({ vault: "global" }, context)).toMatchObject({
      succeeded: true,
      output: { warnings: [] },
    })
  },
)
