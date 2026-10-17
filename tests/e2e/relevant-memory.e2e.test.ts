import { expect, test } from "vitest"

import {
  DOCTOR_TITLE,
  LAYA_OPTION,
  MEMORY_DOCTOR_COMMAND,
  MEMORY_SETUP_COMMAND,
  SETTINGS_TITLE,
  STATUS_SEARCHING,
} from "#src/pi"
import { DECISION_UNAVAILABLE } from "#src/usecases"
import {
  DEPLOY,
  decision,
  dialogTitled,
  dontForgetText,
  endpoint,
  LAYA_DEFAULTS,
  leaveScreen,
  noteBlock,
  noticesStarting,
  notifySettles,
  nth,
  pickLine,
  putDeployNote,
  RELEASE,
  relevantMessage,
  relevantMessages,
  relevantWorld,
  restartMemory,
  rewriteConfig,
  SAY_OK,
  startLaya,
  statusStates,
  storedConfig,
  typing,
  writeVaultFile,
} from "#test-helpers"

const LOOPBACK_PROBLEM =
  "decisionModel.endpoint: must be a loopback HTTP(S) /v1/systemone URL without credentials, query or fragment"
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
