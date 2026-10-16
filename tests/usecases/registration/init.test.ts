import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { initProjectMemory } from "#src/usecases"
import {
  customizedSettings,
  expectRegistrationAssets,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("init adds a project preserving every setting without repairing unrelated global assets", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const configured = { ...config, ...customizedSettings() }
  const expectedHash = await writeRegistrationSnapshot(context, JSON.stringify(configured))
  const vault = join(root, "project")
  expect(await initProjectMemory({ name: "Project", vault: "../project", expectedHash }, context)).toMatchObject({
    succeeded: true,
  })
  await expectRegistrationAssets(vault)
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual({
    ...configured,
    projects: [{ name: "Project", folder: context.workingFolder, vault }],
  })
  expect(await readdir(root)).not.toContain("global")
  await expectRegistrationLeaseReleased(context)
})

test("init repoints the longest matching project without changing its working root or old vault bytes", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const broad = { name: "Broad", folder: context.workingFolder, vault: join(root, "broad") }
  const narrow = { name: "Narrow", folder: join(context.workingFolder, "nested"), vault: join(root, "narrow") }
  const configured = { ...config, ...customizedSettings(), projects: [broad, narrow] }
  await mkdir(narrow.vault)
  const bytes = Buffer.from([1, 255, 13, 10])
  await writeFile(join(narrow.vault, "keep.md"), bytes)
  const expectedHash = await writeRegistrationSnapshot(context, JSON.stringify(configured))
  const vault = join(root, "repointed")
  const result = await initProjectMemory(
    { name: "Renamed", vault, expectedHash },
    {
      ...context,
      workingFolder: join(narrow.folder, "src"),
    },
  )
  expect(result.succeeded).toBe(true)
  await expectRegistrationAssets(vault)
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual({
    ...configured,
    projects: [broad, { ...narrow, name: "Renamed", vault }],
  })
  expect(await readdir(narrow.vault)).toEqual(["keep.md"])
  expect(await readFile(join(narrow.vault, "keep.md"))).toEqual(bytes)
  expect(await readdir(root)).not.toContain("broad")
  expect(await readdir(root)).not.toContain("global")
})

test("init captures name, vault, hash and context before admission yields", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const other = await registrationUsecaseFixture()
  const original = { ...context }
  const expectedHash = await writeRegistrationSnapshot(context, JSON.stringify(config))
  const request = { name: "Submitted", vault: "../project", expectedHash }
  const pending = initProjectMemory(request, context)
  request.name = "Changed"
  request.vault = "../changed"
  request.expectedHash = "changed"
  Object.assign(context, other.context)
  expect(await pending).toMatchObject({ succeeded: true })
  const vault = join(root, "project")
  await expectRegistrationAssets(vault)
  expect(JSON.parse(await readFile(original.configPath, "utf8"))).toEqual({
    ...config,
    projects: [{ name: "Submitted", folder: original.workingFolder, vault }],
  })
  expect(await readdir(root)).toEqual(["machine", "project"])
  expect(await readdir(other.root)).toEqual([])
  expect(original.session.isCurrent(original.stamp)).toBe(false)
  expect(other.context.session.isCurrent(other.context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(original)
})

test("init rejects a mismatching initial source hash before canonicalizing its proposal", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  await writeFile(config.global.vault, "not a vault directory")
  const text = JSON.stringify(config)
  await writeRegistrationSnapshot(context, text)
  const before = await registrationDiskTree(root)
  const result = await initProjectMemory({ name: "Project", vault: "../project", expectedHash: "stale" }, context)
  expect(result).toEqual({
    succeeded: false,
    stage: "validation",
    cause: {
      succeeded: false,
      reason: "conflict",
      problems: ["config changed since it was read"],
      warnings: [],
    },
    problems: ["config changed since it was read"],
    assets: { createdRoot: false, created: [], preserved: [], maintenanceProblems: [] },
  })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(context.configPath, "utf8")).toBe(text)
  expect(await readFile(config.global.vault, "utf8")).toBe("not a vault directory")
  expect(context.session.isCurrent(context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test("init refuses absent or invalid global config and stale snapshots without assets", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const request = { name: "Project", vault: join(root, "project"), expectedHash: "missing" }
  expect(await initProjectMemory(request, context)).toMatchObject({ succeeded: false, stage: "validation" })
  expect(await readdir(root)).toEqual([])
  for (const text of ["{broken", JSON.stringify({ ...config, global: {} }), JSON.stringify(config)]) {
    const hash = await writeRegistrationSnapshot(context, text)
    const before = await registrationDiskTree(root)
    let expectedHash = hash
    if (text === JSON.stringify(config)) expectedHash = "stale"
    expect(await initProjectMemory({ ...request, expectedHash }, context)).toMatchObject({
      succeeded: false,
      stage: "validation",
    })
    expect(await registrationDiskTree(root)).toEqual(before)
    expect(await readFile(context.configPath, "utf8")).toBe(text)
    await expectRegistrationLeaseReleased(context)
  }
})
