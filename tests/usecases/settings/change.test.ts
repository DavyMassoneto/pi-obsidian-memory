import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { changeMemorySettings } from "#src/usecases"
import {
  configuredSettings,
  expectRegistrationAssets,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
  writtenConfig,
} from "#test-helpers"

test("a change reaches the file and nothing else in it changes", async () => {
  const { context, config, hash } = await configuredSettings()
  const model = { provider: "other", id: "model-x" }

  const result = await changeMemorySettings({ change: { kind: "observerModel", model }, expectedHash: hash }, context)

  expect(result).toMatchObject({ succeeded: true, output: { config: { observer: { model } } } })
  expect(await writtenConfig(context.configPath)).toEqual({ ...config, observer: { ...config.observer, model } })
  await expectRegistrationLeaseReleased(context)
})

test("the reported hash is the hash of the file now on disk, so another change can follow", async () => {
  const { context, hash } = await configuredSettings()
  const first = await changeMemorySettings({ change: { kind: "budgetChars", value: 500 }, expectedHash: hash }, context)
  if (!first.succeeded) throw new Error(first.problems.join("; "))

  const second = await changeMemorySettings(
    { change: { kind: "limit", name: "maxBodyChars", value: 7 }, expectedHash: first.output.configHash },
    { ...context, stamp: context.session.stamp() },
  )

  expect(second).toMatchObject({ succeeded: true, output: { config: { context: { budgetChars: 500 } } } })
  expect(await writtenConfig(context.configPath)).toMatchObject({
    context: { budgetChars: 500 },
    limits: { maxBodyChars: 7 },
  })
})

test("the session stops trusting the old config, so the change applies at once", async () => {
  const { context, hash } = await configuredSettings()
  const before = context.stamp

  await changeMemorySettings({ change: { kind: "budgetChars", value: 500 }, expectedHash: hash }, context)

  expect(context.session.isCurrent(before)).toBe(false)
})

test("a file that changed on disk since it was read is a conflict and stays as it is", async () => {
  const { context, config, hash } = await configuredSettings()
  const edited = JSON.stringify({ ...config, context: { budgetChars: 99 } })
  await writeFile(context.configPath, edited)

  const result = await changeMemorySettings(
    { change: { kind: "budgetChars", value: 500 }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(context.configPath, "utf8")).toBe(edited)
  await expectRegistrationLeaseReleased(context)
})

test("a value the schema refuses leaves the file byte-identical and names the problem", async () => {
  const { context, root, hash } = await configuredSettings()
  const before = await readFile(context.configPath, "utf8")
  const tree = await registrationDiskTree(root)

  const result = await changeMemorySettings(
    { change: { kind: "gateThreshold", value: 1.5 }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({
    succeeded: false,
    reason: "refused",
    problems: [expect.stringContaining("gateThreshold")],
  })
  expect(await readFile(context.configPath, "utf8")).toBe(before)
  expect(await registrationDiskTree(root)).toEqual(tree)
})

test("switching to Jev clears the thresholds in the file", async () => {
  const { context, hash } = await configuredSettings()
  const gated = await changeMemorySettings(
    { change: { kind: "gateThreshold", value: 0.3 }, expectedHash: hash },
    context,
  )
  if (!gated.succeeded) throw new Error(gated.problems.join("; "))

  await changeMemorySettings(
    { change: { kind: "decision", provider: "typesafe" }, expectedHash: gated.output.configHash },
    { ...context, stamp: context.session.stamp() },
  )

  expect((await writtenConfig(context.configPath)).decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
})

test("repointing a project to an existing folder gets the templates and Memory.base, keeps what is there, and leaves the old vault alone", async () => {
  const { context, root, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const first = join(root, "first")
  const second = join(root, "second")
  await mkdir(first)
  await mkdir(second)
  await writeFile(join(second, "mine.md"), "x")
  await mkdir(join(second, "_templates"))
  await writeFile(join(second, "_templates", "rule.md"), "my own rule template")
  const project = { name: "shop", folder: context.workingFolder, vault: first }
  const hash = await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [project] }))

  const result = await changeMemorySettings(
    { change: { kind: "projectVault", name: "shop", vault: second }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: true })
  expect((await writtenConfig(context.configPath)).projects).toEqual([{ ...project, vault: second }])
  expect((await readdir(second)).sort()).toEqual(["Memory.base", "_templates", "mine.md"])
  expect(await readdir(join(second, "_templates"))).toHaveLength(12)
  expect(await readFile(join(second, "_templates", "rule.md"), "utf8")).toBe("my own rule template")
  expect(await readFile(join(second, "mine.md"), "utf8")).toBe("x")
  expect(await readdir(first)).toEqual([])
})

test("repointing a project to a folder that does not exist creates it with the templates and Memory.base", async () => {
  const { context, root, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const first = join(root, "first")
  await mkdir(first)
  await writeFile(join(first, "keep.md"), "old")
  const project = { name: "shop", folder: context.workingFolder, vault: first }
  const hash = await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [project] }))
  const created = join(root, "brand new")

  const result = await changeMemorySettings(
    { change: { kind: "projectVault", name: "shop", vault: created }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: true })
  await expectRegistrationAssets(created)
  expect((await writtenConfig(context.configPath)).projects).toEqual([{ ...project, vault: created }])
  expect(await readdir(first)).toEqual(["keep.md"])
})

test("a vault that the config refuses is refused before anything is created", async () => {
  const { context, root, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const first = join(root, "first")
  await mkdir(first)
  const project = { name: "shop", folder: context.workingFolder, vault: first }
  const hash = await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [project] }))
  const tree = await registrationDiskTree(root)

  const result = await changeMemorySettings(
    { change: { kind: "projectVault", name: "shop", vault: join(config.global.vault, "inner") }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "refused" })
  expect(await registrationDiskTree(root)).toEqual(tree)
})

test("repointing a project to a path that is a file is refused and nothing is created", async () => {
  const name = "file.md"
  const { context, root, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const first = join(root, "first")
  await mkdir(first)
  await writeFile(join(root, "file.md"), "x")
  const project = { name: "shop", folder: context.workingFolder, vault: first }
  const hash = await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [project] }))
  const before = await readFile(context.configPath, "utf8")
  const tree = await registrationDiskTree(root)

  const result = await changeMemorySettings(
    { change: { kind: "projectVault", name: "shop", vault: join(root, name) }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "refused" })
  expect(await readFile(context.configPath, "utf8")).toBe(before)
  expect(await registrationDiskTree(root)).toEqual(tree)
})

test("removing a project leaves its vault files untouched", async () => {
  const { context, root, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const vault = join(root, "shop-vault")
  await mkdir(vault)
  const bytes = Buffer.from([0, 255, 13, 10])
  await writeFile(join(vault, "keep.md"), bytes)
  const project = { name: "shop", folder: context.workingFolder, vault }
  const hash = await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [project] }))

  const result = await changeMemorySettings(
    { change: { kind: "removeProject", name: "shop" }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: true })
  expect((await writtenConfig(context.configPath)).projects).toEqual([])
  expect(await readFile(join(vault, "keep.md"))).toEqual(bytes)
})

test("a cancelled session writes nothing", async () => {
  const { context, controller, hash } = await configuredSettings()
  const before = await readFile(context.configPath, "utf8")
  controller.abort()

  const result = await changeMemorySettings(
    { change: { kind: "budgetChars", value: 500 }, expectedHash: hash },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "cancelled" })
  expect(await readFile(context.configPath, "utf8")).toBe(before)
})
