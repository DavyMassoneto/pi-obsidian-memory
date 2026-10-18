import { expect, test } from "vitest"

import { CAPTURE_MODEL_TITLE, CURRENT_MARK, SAVED, SETTINGS_TITLE } from "#src/pi"
import {
  anotherModel,
  configuredWorld,
  dialogsTitled,
  E2E_MODEL_LABEL,
  leaveScreen,
  modelRef,
  optionsOf,
  pickLine,
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
