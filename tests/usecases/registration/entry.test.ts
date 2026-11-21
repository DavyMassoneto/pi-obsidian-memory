import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { initProjectMemory, prepareMemorySetup, setupMemory } from "#src/usecases"
import {
  expectRegistrationAssets,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test.each([
  { name: "prepare", run: prepareMemorySetup },
  { name: "setup", run: setupMemory },
  { name: "init", run: initProjectMemory },
])("$name cannot upgrade a granted admission by replacing the caller stamp", async ({ run }) => {
  const { root, context, request } = await registrationUsecaseFixture()
  const pending = run(
    { ...request, selectedModel: null, name: "Project", vault: "../project", expectedHash: "old" },
    context,
  )
  context.session.invalidate({ sessionId: "new", branchId: "new-branch" })
  const newer = context.session.stamp()
  context.stamp = newer
  expect(await pending).toMatchObject({
    succeeded: false,
    problems: ["registration cancelled or session authority changed"],
  })
  expect(await readdir(root)).toEqual([])
  expect(context.session.stamp()).toBe(newer)
  expect(context.session.isCurrent(newer)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test.each([
  { name: "prepare", run: prepareMemorySetup },
  { name: "setup", run: setupMemory },
  { name: "init", run: initProjectMemory },
])("$name retains the caller signal when its context field is replaced", async ({ run }) => {
  const { root, context, controller, request } = await registrationUsecaseFixture()
  const pending = run(
    { ...request, selectedModel: null, name: "Project", vault: "../project", expectedHash: "old" },
    context,
  )
  controller.abort()
  context.signal = new AbortController().signal
  expect(await pending).toMatchObject({
    succeeded: false,
    problems: ["registration cancelled or session authority changed"],
  })
  expect(await readdir(root)).toEqual([])
  expect(context.session.isCurrent(context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test("setup retains its session and paths through publication and invalidates only the original authority", async () => {
  const { root, context, request } = await registrationUsecaseFixture()
  const other = await registrationUsecaseFixture()
  const original = { ...context }
  request.config.global.vault = "../chosen"
  const pending = setupMemory(request, context)
  Object.assign(context, other.context)
  expect(await pending).toMatchObject({ succeeded: true })
  await expectRegistrationAssets(join(root, "chosen"))
  expect(JSON.parse(await readFile(original.configPath, "utf8"))).toEqual({
    ...request.config,
    global: { vault: join(root, "chosen") },
  })
  expect(await readdir(other.root)).toEqual([])
  expect(original.session.isCurrent(original.stamp)).toBe(false)
  expect(other.context.session.isCurrent(other.context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(original)
  await expectRegistrationLeaseReleased(other.context)
})

test("setup cannot replace an unsafe entry index path during admission", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const safeIndex = context.indexPath
  context.indexPath = join(config.global.vault, "index")
  const pending = setupMemory(request, context)
  context.indexPath = safeIndex
  expect(await pending).toMatchObject({ succeeded: false, stage: "validation", assets: { created: [] } })
  expect(await readdir(root)).toEqual([])
})

test("setup owns every nested submitted config value across the canonicalization checkpoint", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const project = { name: "Keep", folder: join(root, "other-work"), vault: join(root, "other-vault") }
  const submitted = { ...config, projects: [project] }
  const original = structuredClone(submitted)
  const pending = setupMemory({ ...request, config: submitted }, context)
  await Promise.resolve()
  submitted.capture.model.id = ""
  submitted.capture.reviewEnabled = false
  submitted.memoryAgent.model.provider = "changed"
  submitted.limits.maxBodyChars = 1
  submitted.context.budgetChars = 1
  submitted.embeddings.model = "gemini-embedding-001"
  submitted.decisionModel.model = "jev-latest"
  project.name = "Changed"
  project.vault = join(root, "changed-project")
  submitted.projects.push({ name: "Added", folder: join(root, "added-work"), vault: join(root, "added-vault") })
  submitted.global.vault = join(root, "changed-global")
  expect(await pending).toMatchObject({ succeeded: true })
  expect(await readFile(context.configPath, "utf8")).toBe(`${JSON.stringify(original, null, 2)}\n`)
  await expectRegistrationAssets(original.global.vault)
  expect(await readdir(root)).toEqual(["global", "machine"])
})

test("setup ignores an invalid model mutation after exactly one promise checkpoint", async () => {
  const { root, context, request } = await registrationUsecaseFixture()
  const original = structuredClone(request.config)
  const pending = setupMemory(request, context)
  await Promise.resolve()
  request.config.capture.model.id = ""
  const result = await pending
  expect(result).toEqual({
    succeeded: true,
    output: {
      configHash: expect.any(String),
      assets: { createdRoot: true, created: expect.any(Array), preserved: [], maintenanceProblems: [] },
      warnings: [],
    },
  })
  expect(await readFile(context.configPath, "utf8")).toBe(`${JSON.stringify(original, null, 2)}\n`)
  await expectRegistrationAssets(original.global.vault)
  expect(await readdir(root)).toEqual(["global", "machine"])
})

test("setup refuses uncloneable extra config values without admitting resource work", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const submitted = { ...config, uncloneable: () => true }
  const result = await setupMemory({ ...request, config: submitted }, context)
  expect(result).toMatchObject({ succeeded: false, stage: "validation", assets: { created: [] } })
  expect(await readdir(root)).toEqual([])
  await expectRegistrationLeaseReleased(context)
})

test("setup captures the config object before a caller replaces it during admission", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const original = structuredClone(config)
  const pending = setupMemory(request, context)
  request.config = { ...config, global: { vault: join(root, "replacement") } }
  expect(await pending).toMatchObject({ succeeded: true })
  expect(await readFile(context.configPath, "utf8")).toBe(`${JSON.stringify(original, null, 2)}\n`)
  await expectRegistrationAssets(original.global.vault)
  expect(await readdir(root)).toEqual(["global", "machine"])
})

test("setup preserves submitted unknown keys instead of losing them during capture", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  for (const submitted of [
    { ...config, unexpected: true },
    { ...config, capture: { ...config.capture, unexpected: true } },
    { ...config, capture: { ...config.capture, model: { ...config.capture.model, unexpected: true } } },
    { ...config, projects: [{ name: "P", folder: context.workingFolder, vault: join(root, "p"), unexpected: true }] },
  ]) {
    const pending = setupMemory({ ...request, config: submitted }, context)
    expect(await pending).toMatchObject({ succeeded: false, stage: "validation", assets: { created: [] } })
    expect(await readdir(root)).toEqual([])
  }
})

test("init cannot replace its submitted hash during admission to accept a different source", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const text = JSON.stringify(config)
  const actualHash = await writeRegistrationSnapshot(context, text)
  const before = await registrationDiskTree(root)
  const request = { name: "Project", vault: "../project", expectedHash: "submitted-stale-hash" }
  const pending = initProjectMemory(request, context)
  request.expectedHash = actualHash
  expect(await pending).toMatchObject({ succeeded: false, stage: "validation", cause: { reason: "conflict" } })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(context.configPath, "utf8")).toBe(text)
})
