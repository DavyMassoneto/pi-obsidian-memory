import { mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { initProjectMemory, prepareMemorySetup, setupMemory } from "#/usecases"
import {
  expectRegistrationAssets,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("bootstrap failure reports retained partial assets and never publishes config", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  await mkdir(join(config.global.vault, "Memory.base"), { recursive: true })
  const result = await setupMemory(request, context)
  expect(result).toMatchObject({ succeeded: false, stage: "bootstrap", cause: { failure: { reason: "not-file" } } })
  if (result.succeeded) throw new Error("expected bootstrap failure")
  expect(result.assets.created.length).toBeGreaterThan(0)
  for (const path of result.assets.created) {
    expect((await readFile(join(config.global.vault, path))).length).toBeGreaterThan(0)
  }
  expect(await readdir(root)).toEqual(["global"])
  expect(context.session.isCurrent(context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test("occupied publication lock fails after bootstrap retaining assets, original config and foreign lock", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const text = JSON.stringify(config)
  const expectedHash = await writeRegistrationSnapshot(context, text)
  const lock = join(dirname(context.configPath), ".config.json.lock")
  await writeFile(lock, "foreign lock")
  const vault = join(root, "chosen")
  const result = await setupMemory({ ...request, config: { ...config, global: { vault } }, expectedHash }, context)
  expect(result).toMatchObject({
    succeeded: false,
    stage: "config",
    cause: { reason: "unavailable" },
    assets: { createdRoot: true },
  })
  await expectRegistrationAssets(vault)
  expect(await readFile(context.configPath, "utf8")).toBe(text)
  expect(await readFile(lock, "utf8")).toBe("foreign lock")
  expect(await readdir(dirname(context.configPath))).toEqual([".config.json.lock", "config.json"])
  expect(context.session.isCurrent(context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})

test("lexical overlap and canonical alias overlap refuse before bootstrap", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  const alias = join(root, "alias")
  await symlink(config.global.vault, alias, "junction")
  const before = await registrationDiskTree(root)
  for (const vault of [config.global.vault, join(config.global.vault, "nested"), alias, join(alias, "nested")]) {
    const projects = [{ name: "project", folder: context.workingFolder, vault }]
    expect(await setupMemory({ ...request, config: { ...config, projects } }, context)).toMatchObject({
      succeeded: false,
      stage: "validation",
    })
    expect(await registrationDiskTree(root)).toEqual(before)
  }
  await expectRegistrationLeaseReleased(context)
})

test("config and index infrastructure inside any registered vault, including aliases, refuse without writes", async () => {
  const { root, context, config, request } = await registrationUsecaseFixture()
  const other = join(root, "other-vault")
  await mkdir(other)
  const alias = join(root, "alias")
  await symlink(other, alias, "junction")
  const proposed = { ...config, projects: [{ name: "other", folder: join(root, "other-work"), vault: other }] }
  const before = await registrationDiskTree(root)
  for (const base of [other, alias]) {
    for (const changed of [
      { ...context, configPath: join(base, "config.json") },
      { ...context, indexPath: join(base, "index") },
    ]) {
      expect(await setupMemory({ ...request, config: proposed }, changed)).toMatchObject({
        succeeded: false,
        stage: "validation",
      })
      expect(await registrationDiskTree(root)).toEqual(before)
    }
  }
})

test("already cancelled, stale and terminal authority performs no writes in every entry point", async () => {
  for (const mode of ["cancelled", "stale", "terminal", "stopped"]) {
    const { root, context, controller, request } = await registrationUsecaseFixture()
    if (mode === "cancelled") controller.abort()
    if (mode === "stale") context.session.invalidate({ sessionId: "new", branchId: null })
    if (mode === "terminal") context.session.abortPending()
    if (mode === "stopped") context.session.stopAdmissions()
    expect(await prepareMemorySetup({ selectedModel: null }, context)).toMatchObject({ succeeded: false })
    expect(await setupMemory(request, context)).toMatchObject({ succeeded: false, assets: { created: [] } })
    expect(await initProjectMemory({ name: "new", vault: "../project", expectedHash: "old" }, context)).toMatchObject({
      succeeded: false,
    })
    expect(await readdir(root)).toEqual([])
    await context.session.drain()
  }
})

test("cancellation while queued releases admission without writes or invalidating fresh authority", async () => {
  const { root, context, controller, request } = await registrationUsecaseFixture()
  const held = await context.session.acquire(context.stamp, context.signal)
  if (!held) throw new Error("lease unavailable")
  const waiting = setupMemory(request, context)
  controller.abort()
  expect(await waiting).toMatchObject({ succeeded: false })
  held.release()
  expect(await readdir(root)).toEqual([])
  expect(context.session.isCurrent(context.stamp)).toBe(true)
  await expectRegistrationLeaseReleased(context)
})
