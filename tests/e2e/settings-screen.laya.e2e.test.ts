import { expect, test } from "vitest"

import { DONE_LABEL, SETTINGS_TITLE, settingLines } from "#src/pi"
import { configuredWorld, leaveScreen, onLaya, optionsOf, settingsScreen, storedConfig } from "#test-helpers"

test("the cutoffs of Laya read not set", async () => {
  const world = await configuredWorld({})
  await onLaya(world, {})
  await settingsScreen(world, [leaveScreen])
  const labels = settingLines(await storedConfig(world)).map((line) => line.label)
  expect(optionsOf(world, SETTINGS_TITLE)).toEqual([...labels, DONE_LABEL])
  expect(world.pi.unexpected).toEqual([])
})
