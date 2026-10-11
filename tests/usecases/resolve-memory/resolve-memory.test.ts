import { mkdir, realpath, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { getMemory, listMemory, resolveMemory } from "#/usecases"
import {
  expectRegistrationLeaseReleased,
  linkFolder,
  memoryReadFixture,
  memoryReadTree,
  noteText,
  putCatalogFile,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("resolves global and longest canonical current project only, while retaining all protected roots", async () => {
  const { root, context, config } = await memoryReadFixture()
  config.projects = [
    { name: "parent", folder: context.workingFolder, vault: join(root, "parent") },
    { name: "child", folder: join(context.workingFolder, "child"), vault: join(root, "child") },
    { name: "other", folder: join(root, "elsewhere"), vault: join(root, "other") },
  ]
  await mkdir(join(context.workingFolder, "child", "src"), { recursive: true })
  await linkFolder(context.workingFolder, join(root, "work-alias"))
  context.workingFolder = join(root, "work-alias", "child", "src")
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  const canonicalRoot = await realpath(root)
  expect(await resolveMemory(context)).toMatchObject({
    succeeded: true,
    output: {
      global: { scope: "global", vault: { path: join(canonicalRoot, "global") } },
      project: { scope: "project", vault: { path: join(canonicalRoot, "child") } },
      protectedRoots: ["global", "parent", "child", "other"].map((name) => join(canonicalRoot, name)),
    },
  })
  await expectRegistrationLeaseReleased(context)
})

test("unregistered project refuses precisely without hiding accessible global scope", async () => {
  const { context } = await memoryReadFixture()
  expect(await resolveMemory(context)).toMatchObject({ succeeded: true, output: { project: null } })
  expect(await listMemory({ vault: "project", folder: "" }, context)).toMatchObject({
    succeeded: false,
    reason: "no-project",
  })
})

test("missing and invalid configs refuse without using extracted vault paths or creating any files", async () => {
  const { root, context, config } = await memoryReadFixture()
  await rm(context.configPath)
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "not-configured" })
  context.stamp = context.session.stamp()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, global: { vault: join(root, "unavailable") }, extra: true }),
  )
  const before = await memoryReadTree(root)
  const result = await getMemory({ vault: "global", path: "Note.md", sourceCallId: "invalid" }, context)
  expect(result).toMatchObject({ succeeded: false, reason: "invalid-config" })
  expect(result.succeeded).toBe(false)
  if (!result.succeeded) expect(result.problems.join(" ")).toContain("extra")
  expect(await memoryReadTree(root)).toEqual(before)
  await expectRegistrationLeaseReleased(context)
})

test.each(["nested-root", "index-in-vault", "config-in-vault"])(
  "canonical validation refuses %s before reading vault content",
  async (problem) => {
    const { root, context, config } = await memoryReadFixture()
    await linkFolder(config.global.vault, join(root, "alias"))
    if (problem === "nested-root") {
      config.projects = [{ name: "p", folder: context.workingFolder, vault: join(root, "alias", "nested") }]
    }
    if (problem === "index-in-vault") context.indexPath = join(root, "alias", "index")
    if (problem === "config-in-vault") context.configPath = join(root, "alias", "config.json")
    await writeRegistrationSnapshot(context, JSON.stringify(config))
    const before = await memoryReadTree(root)
    expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "invalid-config" })
    expect(await memoryReadTree(root)).toEqual(before)
  },
)

test("changed config hash invalidates old stamp and receipts and requires explicit fresh admission", async () => {
  const { vault, config, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "body"))
  const address = { vault: "global", path: "Note.md", sourceCallId: "first" }
  await getMemory({ ...address, vault: "global" }, context)
  const oldStamp = context.stamp
  config.context.budgetChars += 1
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "stale-session" })
  expect(context.session.isCurrent(oldStamp)).toBe(false)
  expect(context.session.getReceipt(context.session.stamp(), { vault: "global", path: "Note.md" })).toBeNull()
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false })
  context.stamp = context.session.stamp()
  expect((await resolveMemory(context)).succeeded).toBe(true)
})
