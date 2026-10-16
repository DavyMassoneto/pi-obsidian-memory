import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { setupMemory } from "#src/usecases"
import {
  deliveredRead,
  expectRegistrationAssets,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("setup bootstraps all global assets, publishes complete config last and invalidates receipts", async () => {
  const { context, config, request } = await registrationUsecaseFixture()
  context.session.rememberGet(context.stamp, deliveredRead())
  const result = await setupMemory(request, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { assets: { createdRoot: true, created: expect.any(Array) } },
  })
  await expectRegistrationAssets(config.global.vault)
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual(config)
  expect(context.session.isCurrent(context.stamp)).toBe(false)
  expect(context.session.getReceipt(context.session.stamp(), deliveredRead())).toBeNull()
  await expectRegistrationLeaseReleased(context)
})

test("repoint creates only the selected target and preserves existing assets and old source bytes", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const oldNote = join(config.global.vault, "keep.md")
  const bytes = Buffer.from([0, 255, 13, 10])
  await writeFile(oldNote, bytes)
  const expectedHash = await writeRegistrationSnapshot(context, JSON.stringify(config))
  const vault = join(root, "new-global")
  await mkdir(join(vault, "_templates"), { recursive: true })
  await writeFile(join(vault, "Memory.base"), "edited dashboard\r\n")
  await writeFile(join(vault, "_templates", "rule.md"), "edited rule\r\n")
  const result = await setupMemory({ ...request, config: { ...config, global: { vault } }, expectedHash }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      assets: {
        preserved: expect.arrayContaining(["Memory.base", "_templates/rule.md"]),
      },
    },
  })
  expect(await readFile(oldNote)).toEqual(bytes)
  expect(await readdir(config.global.vault)).toEqual(["keep.md"])
  expect(await readFile(join(vault, "Memory.base"), "utf8")).toBe("edited dashboard\r\n")
  expect(await readFile(join(vault, "_templates", "rule.md"), "utf8")).toBe("edited rule\r\n")
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual({ ...config, global: { vault } })
})

test("stale expected hashes refuse before creating assets", async () => {
  const { root, context, request } = await registrationUsecaseFixture()
  for (const refused of [{ ...request, expectedHash: "stale" }]) {
    expect(await setupMemory(refused, context)).toMatchObject({
      succeeded: false,
      stage: "validation",
      assets: { created: [] },
    })
    expect(await readdir(root)).toEqual([])
    await expectRegistrationLeaseReleased(context)
  }
})

test("malformed JSON requires replacement confirmation before any bootstrap", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const expectedHash = await writeRegistrationSnapshot(context, "{malformed")
  const before = await registrationDiskTree(root)
  expect(await setupMemory({ ...request, expectedHash }, context)).toMatchObject({
    succeeded: false,
    stage: "validation",
    cause: { reason: "replacement-required" },
  })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(context.configPath, "utf8")).toBe("{malformed")
  expect(await setupMemory({ ...request, expectedHash, replacementConfirmed: true }, context)).toMatchObject({
    succeeded: true,
  })
  await expectRegistrationAssets(config.global.vault)
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual(config)
})

test("strict commit refuses unresolved selected model and unknown fields without writes", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  for (const proposed of [
    { ...config, capture: { ...config.capture, model: { provider: "", id: "" } } },
    { ...config, secret: "not-config" },
  ]) {
    expect(await setupMemory({ ...request, config: proposed }, context)).toMatchObject({
      succeeded: false,
      stage: "validation",
    })
    expect(await readdir(root)).toEqual([])
  }
})

test("setup cannot upgrade its granted lease by replacing the stamp with a newer generation", async () => {
  const { root, context, request } = await registrationUsecaseFixture()
  const pending = setupMemory(request, context)
  context.session.invalidate({ sessionId: "new", branchId: "new-branch" })
  const newer = context.session.stamp()
  context.stamp = newer
  expect(await pending).toMatchObject({
    succeeded: false,
    stage: "validation",
    problems: ["registration cancelled or session authority changed"],
    assets: { createdRoot: false, created: [], preserved: [], maintenanceProblems: [] },
  })
  expect(await readdir(root)).toEqual([])
  expect(context.session.stamp()).toBe(newer)
  expect(context.session.isCurrent(newer)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test.each(["hash", "replacement"])("setup captures %s approval before admission yields", async (field) => {
  const { root, context, request } = await registrationUsecaseFixture()
  const text = "{malformed"
  const expectedHash = await writeRegistrationSnapshot(context, text)
  const submitted = { ...request, expectedHash, replacementConfirmed: true }
  if (field === "hash") submitted.expectedHash = "stale"
  if (field === "replacement") submitted.replacementConfirmed = false
  const before = await registrationDiskTree(root)
  const pending = setupMemory(submitted, context)
  submitted.expectedHash = expectedHash
  submitted.replacementConfirmed = true
  const result = await pending
  expect(result).toMatchObject({ succeeded: false, stage: "validation", assets: { created: [] } })
  if (field === "hash") expect(result).toMatchObject({ cause: { reason: "conflict" } })
  if (field === "replacement") expect(result).toMatchObject({ cause: { reason: "replacement-required" } })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(context.configPath, "utf8")).toBe(text)
  await expectRegistrationLeaseReleased(context)
})

test("relative selected global vault is resolved against supplied working folder only", async () => {
  const { context, config, request } = await registrationUsecaseFixture()
  const result = await setupMemory({ ...request, config: { ...config, global: { vault: "../chosen" } } }, context)
  expect(result.succeeded).toBe(true)
  await expectRegistrationAssets(join(context.workingFolder, "../chosen"))
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual({
    ...config,
    global: { vault: join(context.workingFolder, "../chosen") },
  })
})
