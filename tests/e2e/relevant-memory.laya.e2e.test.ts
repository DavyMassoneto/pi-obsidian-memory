import { expect, test } from "vitest"

import { DOCTOR_TITLE, LAYA_OPTION, MEMORY_DOCTOR_COMMAND, MEMORY_SETUP_COMMAND, SETTINGS_TITLE } from "#src/pi"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import {
  DEPLOY,
  decision,
  dialogTitled,
  endpoint,
  LAYA_DEFAULTS,
  leaveScreen,
  noteBlock,
  noticesStarting,
  notifySettles,
  nth,
  pickLine,
  putDeployNote,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  startLaya,
  storedConfig,
  typing,
} from "#test-helpers"

const LOOPBACK_PROBLEM =
  "decisionModel.endpoint: must be a loopback HTTP(S) /v1/systemone URL without credentials, query or fragment"
const deployBlock = noteBlock("project", DEPLOY.path, DEPLOY.body)

test("a Laya endpoint that is not a loopback address is refused and the config keeps Jev", async () => {
  const world = await relevantWorld()
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      pickLine("Decision model:"),
      decision(LAYA_OPTION),
      endpoint({ value: "http://localhost:8000/v1/systemone" }),
      leaveScreen,
    ],
    nth(dialogTitled(SETTINGS_TITLE), 2),
  )
  expect(turn.notifications.filter((notice) => notice.notifyType === "error").map((notice) => notice.message)).toEqual([
    LOOPBACK_PROBLEM,
  ])
  expect((await storedConfig(world)).decisionModel.provider).toBe("typesafe")
})

test("with Laya from the settings screen and both cutoffs set, Laya answers messages and the doctor", async () => {
  const laya = await startLaya(LAYA_DEFAULTS)
  const world = await relevantWorld()
  await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      pickLine("Decision model:"),
      decision(LAYA_OPTION),
      endpoint({ value: laya.endpoint }),
      pickLine("Gate cutoff:"),
      typing("Gate cutoff, 0 to 1", "0"),
      pickLine("Relevance cutoff:"),
      typing("Relevance cutoff, 0 to 1", "0"),
      leaveScreen,
    ],
    nth(dialogTitled(SETTINGS_TITLE), 4),
  )
  expect(world.pi.unexpected).toEqual([])
  expect((await storedConfig(world)).decisionModel).toMatchObject({
    provider: "laya",
    endpoint: laya.endpoint,
    gateThreshold: 0,
    relevanceThreshold: 0,
  })
  await restartMemory(world)
  await putDeployNote(world)
  await world.pi.prompt(DEPLOY.question, [])
  expect(noticesStarting(world, DECISION_UNAVAILABLE)).toEqual([])
  expect(await relevantMessages(world)).toEqual([relevantMessage([deployBlock])])
  const doctor = await world.pi.command(`/${MEMORY_DOCTOR_COMMAND}`, [], notifySettles([DOCTOR_TITLE]))
  expect(doctor.notifications.map((notice) => notice.message).join("\n")).toContain(
    "- decision model laya/multilingual: ready (",
  )
})
