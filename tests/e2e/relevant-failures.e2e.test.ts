import { expect, test } from "vitest"

import { STATUS_SEARCHING } from "#src/pi"
import {
  AGENT_FAILED,
  CUTOFFS_HELP,
  CUTOFFS_MISSING,
  DECISION_UNAVAILABLE,
  ROUTING_MISSING_HELP,
  SESSION_LOAD_FAILED,
} from "#src/usecases"
import {
  closedLayaEndpoint,
  configuredWorld,
  currentMemorySection,
  DECISION_CUTOFFS,
  DEPLOY,
  LAYA_DEFAULTS,
  LAYA_MODEL,
  messageTwiceOnLaya,
  noticesStarting,
  putDeployNote,
  relevantMessages,
  relevantWorld,
  restartMemory,
  rewriteConfig,
  startLaya,
  statusStates,
} from "#test-helpers"

const BOTH_CUTOFFS = { gateThreshold: 0, relevanceThreshold: 0 }

test("a Laya that refuses connections adds nothing, is told once per session and never falls back to Jev", async () => {
  const endpoint = await closedLayaEndpoint()
  const world = await messageTwiceOnLaya({ ...LAYA_MODEL, endpoint, ...DECISION_CUTOFFS })
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([`${DECISION_UNAVAILABLE} unavailable`])
  expect(await relevantMessages(world)).toEqual([])
  expect(statusStates(world, STATUS_SEARCHING.key)).toHaveLength(4)
  expect(statusStates(world, STATUS_SEARCHING.key).at(-1)).toBeUndefined()
})

test("a Laya that does not name the model that answered tells how to run it, once", async () => {
  const { endpoint } = await startLaya({ ...LAYA_DEFAULTS, jevStrict: true })
  const world = await messageTwiceOnLaya({ ...LAYA_MODEL, endpoint, ...BOTH_CUTOFFS })
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([`${DECISION_UNAVAILABLE} ${ROUTING_MISSING_HELP}`])
  expect(await relevantMessages(world)).toEqual([])
})

test("a Laya that rejects the request with 422 is told with the status and its own detail, once", async () => {
  const budget = LAYA_MODEL.maxTokens / 2
  const { endpoint } = await startLaya({ ...LAYA_DEFAULTS, maxTokenBudget: budget })
  const world = await messageTwiceOnLaya({ ...LAYA_MODEL, endpoint, ...BOTH_CUTOFFS })
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([
    `${DECISION_UNAVAILABLE} http-error (HTTP 422): max_len exceeds server limit (${LAYA_MODEL.maxTokens} > ${budget})`,
  ])
  expect(await relevantMessages(world)).toEqual([])
})

test("a Laya that wants a bearer key answers 401, told once with the status and no server detail", async () => {
  const { endpoint } = await startLaya({ ...LAYA_DEFAULTS, apiKey: "e2e-laya-key" })
  const world = await messageTwiceOnLaya({ ...LAYA_MODEL, endpoint, ...BOTH_CUTOFFS })
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([`${DECISION_UNAVAILABLE} http-error (HTTP 401)`])
  expect(await relevantMessages(world)).toEqual([])
})

test("a Laya with no cutoffs adds nothing and tells to set them, once", async () => {
  const { endpoint } = await startLaya(LAYA_DEFAULTS)
  const world = await messageTwiceOnLaya({ ...LAYA_MODEL, endpoint })
  expect(noticesStarting(world, CUTOFFS_MISSING)).toEqual([
    `${CUTOFFS_MISSING} gateThreshold and relevanceThreshold; ${CUTOFFS_HELP}`,
  ])
  expect(await relevantMessages(world)).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

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

test("a Laya whose gate cutoff is 1 adds nothing and says nothing", async () => {
  const { endpoint } = await startLaya(LAYA_DEFAULTS)
  const world = await relevantWorld()
  await rewriteConfig(world, { decisionModel: { ...LAYA_MODEL, endpoint, gateThreshold: 1, relevanceThreshold: 0 } })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  expect(await relevantMessages(world)).toEqual([])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
})
