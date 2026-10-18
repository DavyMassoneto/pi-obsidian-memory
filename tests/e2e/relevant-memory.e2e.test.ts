import { expect, test } from "vitest"

import { STATUS_SEARCHING } from "#src/pi"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import {
  DEPLOY,
  DEPLOY_BLOCK,
  dontForgetText,
  noticesStarting,
  putDeployNote,
  RELEASE,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  statusStates,
  writeVaultFile,
} from "#test-helpers"

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
  expect(await relevantMessages(world)).toEqual([relevantMessage([DEPLOY_BLOCK])])
  expect(statusStates(world, STATUS_SEARCHING.key)).toEqual([
    STATUS_SEARCHING.text,
    undefined,
    STATUS_SEARCHING.text,
    undefined,
  ])
  expect(turn.disposition).toBe("started")
})
