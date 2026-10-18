import { expect, test } from "vitest"

import { AGENT_FAILED, DECISION_UNAVAILABLE, SESSION_LOAD_FAILED } from "#src/usecases"
import {
  configuredWorld,
  currentMemorySection,
  DEPLOY,
  noticesStarting,
  putDeployNote,
  relevantMessages,
  relevantWorld,
  restartMemory,
  rewriteConfig,
} from "#test-helpers"

test("a memory agent whose model pi does not have fails the session load and each message, told once each", async () => {
  const world = await relevantWorld()
  await rewriteConfig(world, { memoryAgent: { model: { provider: "e2e-absent", id: "none" } } })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await world.pi.prompt(DEPLOY.question, [])
  const [loadFailure, ...more] = noticesStarting(world, SESSION_LOAD_FAILED)
  expect(more).toEqual([])
  expect(loadFailure?.startsWith(`${SESSION_LOAD_FAILED} ${AGENT_FAILED}`)).toBe(true)
  expect(noticesStarting(world, AGENT_FAILED)).toHaveLength(1)
  expect(await relevantMessages(world)).toEqual([])
  expect(await currentMemorySection(world)).toContain(loadFailure)
})

test("Jev without a TypeSafe key adds nothing and tells why, once", async () => {
  const world = await configuredWorld({ capture: "at-session-end", withoutTypesafeKey: true })
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  await world.pi.prompt(DEPLOY.question, [])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([`${DECISION_UNAVAILABLE} unavailable`])
  expect(await relevantMessages(world)).toEqual([])
})
