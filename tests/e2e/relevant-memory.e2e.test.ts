import { expect, test } from "vitest"

import { STATUS_SEARCHING } from "#src/pi"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import {
  DEPLOY,
  dontForgetText,
  noteBlock,
  noticesStarting,
  putDeployNote,
  RELEASE,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  rewriteConfig,
  SAY_OK,
  statusStates,
  writeVaultFile,
} from "#test-helpers"

const deployBlock = noteBlock("project", DEPLOY.path, DEPLOY.body)

test("a Don't forget note reaches the model, and Jev adds a relevant project note to a message", async () => {
  const world = await relevantWorld()
  await writeVaultFile(world.folders.globalVault, RELEASE.path, dontForgetText(1, RELEASE.body))
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(
    "Without calling any tool, reply with only the release code word from your Don't forget notes.",
    [],
  )
  expect(await world.pi.lastAssistantText()).toContain("HARBOR-4417")
  const turn = await world.pi.prompt(DEPLOY.question, [])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
  expect(await relevantMessages(world)).toEqual([relevantMessage([deployBlock])])
  expect(statusStates(world, STATUS_SEARCHING.key)).toEqual([
    STATUS_SEARCHING.text,
    undefined,
    STATUS_SEARCHING.text,
    undefined,
  ])
  expect(turn.disposition).toBe("started")
})

test("a message that needs no memory adds no message, though the searching status ran", async () => {
  const world = await relevantWorld()
  await putDeployNote(world)
  await world.pi.prompt(SAY_OK, [])
  expect(await relevantMessages(world)).toEqual([])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
  expect(statusStates(world, STATUS_SEARCHING.key)).toEqual([STATUS_SEARCHING.text, undefined])
})

test("a gate cutoff of 1 in the config adds nothing for a question that needs memory", async () => {
  const world = await relevantWorld()
  await rewriteConfig(world, { decisionModel: { provider: "typesafe", model: "jev-latest", gateThreshold: 1 } })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  expect(await relevantMessages(world)).toEqual([])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
})

test("a relevance cutoff of 1 in the config leaves out a note the gate let through", async () => {
  const world = await relevantWorld()
  await rewriteConfig(world, {
    decisionModel: { provider: "typesafe", model: "jev-latest", gateThreshold: 0, relevanceThreshold: 1 },
  })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  expect(await relevantMessages(world)).toEqual([])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
})
