import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { BLOCK_INTRO, LOAD_FAILURE_PREFIX, LOAD_FAILURE_SUFFIX, STATUS_LOADING } from "#src/pi"
import {
  currentMemorySection,
  DEPLOY,
  dontForgetBlock,
  dontForgetText,
  EMPTY_BLOCK,
  memorySectionHistory,
  NotifySchema,
  noMemoryWorld,
  noteBlock,
  RELEASE,
  recordsOf,
  relevantWorld,
  SAY_OK,
  statusStates,
  writeVaultFile,
} from "#test-helpers"

test("with no marked note the block says it is partial and that no note is marked", async () => {
  const world = await relevantWorld()
  await world.pi.prompt(SAY_OK, [])
  expect(await currentMemorySection(world)).toBe(EMPTY_BLOCK)
  expect(world.pi.unexpected).toEqual([])
})

test("a marked note of each vault is in the block in full, and the model sees it", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, dontForgetText(2, DEPLOY.body))
  await world.restart()
  await world.pi.prompt(
    "Without calling any tool, reply with only the release code word from your Don't forget notes.",
    [],
  )
  expect(await currentMemorySection(world)).toContain(
    dontForgetBlock([noteBlock("global", RELEASE.path, RELEASE.body), noteBlock("project", DEPLOY.path, DEPLOY.body)]),
  )
  expect(await world.pi.lastAssistantText()).toContain("HARBOR-4417")
})

test("the block is set once per session start and drops an archived note at the next one", async () => {
  const world = await relevantWorld()
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await world.restart()
  await world.pi.prompt(SAY_OK, [])
  await mkdir(join(globalVault, "archive"))
  await rename(join(globalVault, RELEASE.path), join(globalVault, "archive", "Release.md"))
  await world.pi.prompt(SAY_OK, [])
  const history = await memorySectionHistory(world)
  expect(history).toHaveLength(1)
  expect(history[0]).toContain(noteBlock("global", RELEASE.path, RELEASE.body))
  await world.pi.newSession()
  await world.pi.prompt(SAY_OK, [])
  expect(await currentMemorySection(world)).toBe(EMPTY_BLOCK)
})

test("without a config there is no block", async () => {
  const world = await noMemoryWorld({ session: "saved" })
  await world.pi.prompt(SAY_OK, [])
  expect(await memorySectionHistory(world)).toEqual([])
})

test("the loading status is shown while the block loads and cleared when it is ready", async () => {
  const world = await relevantWorld()
  expect(statusStates(world, STATUS_LOADING.key)).toEqual([STATUS_LOADING.text, undefined])
})

test("a vault that cannot be read is told once, and the other vault's notes stay in the block", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await rm(world.folders.projectVault, { recursive: true })
  await world.restart()
  await world.pi.prompt(SAY_OK, [])
  const told = recordsOf(NotifySchema, world.pi.lines)
    .map((notice) => notice.message)
    .filter((message) => message.startsWith(`${LOAD_FAILURE_PREFIX} project ${LOAD_FAILURE_SUFFIX}`))
  expect(told).toHaveLength(1)
  const section = await currentMemorySection(world)
  expect(section).toContain(BLOCK_INTRO)
  expect(section).toContain(noteBlock("global", RELEASE.path, RELEASE.body))
  expect(section).toContain(told[0])
})
