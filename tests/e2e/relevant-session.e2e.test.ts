import { expect, test } from "vitest"

import { STATUS_LOADING, STATUS_SEARCHING } from "#src/pi"
import { SESSION_INTRO, SESSION_LOAD_FAILED } from "#src/usecases"
import {
  currentMemorySection,
  DEPLOY,
  DEPLOY_BLOCK,
  dontForgetText,
  noteWithId,
  noticesStarting,
  putDeployNote,
  RELEASE,
  relevantEntries,
  relevantWorld,
  restartMemory,
  rewriteConfig,
  statusCleared,
  statusSet,
  statusSetBeforeClear,
  storedConfig,
  writeVaultFile,
} from "#test-helpers"

test("the first message proceeds while session notes load, then the next message receives them and resume restores them", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  const config = await storedConfig(world)
  await rewriteConfig(world, { decisionModel: { ...config.decisionModel, gateThreshold: 1 } })
  await world.restart()
  await world.pi.waitFor(statusSet(STATUS_LOADING.key), 0)
  await world.pi.prompt("Without tools, reply with only the release code word from your Don't forget notes.", [])
  expect(await world.pi.lastAssistantText()).toContain("HARBOR-4417")
  expect(await currentMemorySection(world)).not.toContain(DEPLOY.body)
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
  expect(statusSetBeforeClear(world, STATUS_SEARCHING.key, STATUS_LOADING.key)).toBe(true)
  expect(noticesStarting(world, SESSION_LOAD_FAILED)).toEqual([])

  await world.pi.prompt("Reply with only READY.", [])
  const entries = await relevantEntries(world)
  expect(entries).toHaveLength(1)
  expect(entries[0]?.content).toContain(SESSION_INTRO)
  expect(entries[0]?.content).toContain(DEPLOY_BLOCK)
  expect(entries[0]?.details.loaded.map((note) => note.path)).toContain(DEPLOY.path)
  expect(entries[0]?.display).toBe(false)

  const file = await world.pi.sessionFile()
  let from = world.pi.lines.length
  await world.pi.newSession()
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), from)
  await rewriteConfig(world, { memoryAgent: { model: { provider: "unavailable", id: "missing" } } })
  await writeVaultFile(world.folders.projectVault, DEPLOY.path, noteWithId(2, `${DEPLOY.body} New detail.`, []))
  from = world.pi.lines.length
  await world.pi.switchSession(file)
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), from)
  await world.pi.prompt("Reply with only READY.", [])
  const resumed = await relevantEntries(world)
  expect(
    resumed.some(
      (entry) =>
        entry.content.includes("replaces the earlier copy") &&
        entry.details.loaded.some((note) => note.path === DEPLOY.path && note.body.includes("New detail.")),
    ),
  ).toBe(true)
})

test("session notes already ready are delivered with the first message", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  const config = await storedConfig(world)
  await rewriteConfig(world, { decisionModel: { ...config.decisionModel, gateThreshold: 1 } })
  await restartMemory(world)
  await world.pi.prompt("Reply with only READY.", [])

  const entries = await relevantEntries(world)
  expect(entries).toHaveLength(1)
  expect(entries[0]?.content).toContain(DEPLOY_BLOCK)
  expect(entries[0]?.details.loaded.map((note) => note.path)).toContain(DEPLOY.path)
})
