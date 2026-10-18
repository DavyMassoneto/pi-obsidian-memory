import { expect, test } from "vitest"

import { AGENT_MODEL_TITLE, CAPTURE_MODEL_TITLE, CURRENT_MARK, SAVED, SETTINGS_TITLE } from "#src/pi"
import {
  anotherModel,
  configText,
  configuredWorld,
  dialogsTitled,
  E2E_MODEL_LABEL,
  leaveScreen,
  modelRef,
  optionsOf,
  pickLine,
  pressEscape,
  settingsScreen,
  storedConfig,
} from "#test-helpers"

test("choosing a capture model from the list writes it, and the next screen shows it", async () => {
  const world = await configuredWorld({})
  const before = await storedConfig(world)
  const other = await anotherModel(world)
  const turn = await settingsScreen(world, [
    pickLine("Capture model:"),
    { method: "select", title: CAPTURE_MODEL_TITLE, answer: { option: modelRef(other) } },
    leaveScreen,
  ])
  expect(turn.notifications.map((notice) => [notice.notifyType, notice.message])).toEqual([
    ["info", `${SAVED} capture model is now ${modelRef(other)}.`],
  ])
  expect(optionsOf(world, CAPTURE_MODEL_TITLE)[0]?.startsWith(`${E2E_MODEL_LABEL} ${CURRENT_MARK}`)).toBe(true)
  expect(dialogsTitled(world, SETTINGS_TITLE)[1]?.options?.[0]).toBe(`Capture model: ${modelRef(other)}`)
  const config = await storedConfig(world)
  expect(config.capture).toEqual({ ...before.capture, model: { provider: other.provider, id: other.id } })
  expect(config.memoryAgent).toEqual(before.memoryAgent)
  expect(world.pi.unexpected).toEqual([])
})

test("the memory-agent model has its own list and its own setting", async () => {
  const world = await configuredWorld({})
  const before = await storedConfig(world)
  const other = await anotherModel(world)
  await settingsScreen(world, [
    pickLine("Memory agent model:"),
    { method: "select", title: AGENT_MODEL_TITLE, answer: { option: modelRef(other) } },
    leaveScreen,
  ])
  const config = await storedConfig(world)
  expect(config.memoryAgent.model).toEqual({ provider: other.provider, id: other.id })
  expect(config.capture).toEqual(before.capture)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  { how: "Escape", answer: pressEscape },
  { how: "an empty answer", answer: { value: "" } },
  { how: "a label that is none of the options", answer: { value: "not in the list" } },
])("$how on a model list keeps the current model and writes nothing", async ({ answer }) => {
  const world = await configuredWorld({})
  const before = await configText(world)
  const turn = await settingsScreen(world, [
    pickLine("Capture model:"),
    { method: "select", title: CAPTURE_MODEL_TITLE, answer },
    leaveScreen,
  ])
  expect(await configText(world)).toBe(before)
  expect(turn.notifications).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

test("each capture switch is flipped by choosing its line, and the next screen shows it", async () => {
  const world = await configuredWorld({})
  await settingsScreen(world, [
    pickLine("Review during the session:"),
    pickLine("Flush at compaction:"),
    pickLine("Flush at session end:"),
    leaveScreen,
  ])
  expect((await storedConfig(world)).capture).toMatchObject({
    reviewEnabled: false,
    flushOnCompact: false,
    flushOnShutdown: false,
  })
  expect(dialogsTitled(world, SETTINGS_TITLE)[1]?.options).toContain("Review during the session: off")
  expect(dialogsTitled(world, SETTINGS_TITLE)[3]?.options).toContain("Flush at session end: off")
  expect(world.pi.unexpected).toEqual([])
})
