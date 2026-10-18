import { expect, test } from "vitest"

import { DONE_LABEL, MEMORY_SETUP_COMMAND, SETTINGS_TITLE, settingLines } from "#src/pi"
import {
  configText,
  configuredWorld,
  dialogsTitled,
  dialogTitled,
  ExtensionErrorSchema,
  leaveScreen,
  optionsOf,
  pickLine,
  pressEscape,
  recordsOf,
  rewriteConfig,
  settingsScreen,
  storedConfig,
} from "#test-helpers"

test("a valid config opens the settings screen: every setting and the projects, each with its current value", async () => {
  const world = await configuredWorld({})
  const config = await storedConfig(world)
  await settingsScreen(world, [leaveScreen])
  expect(dialogsTitled(world, SETTINGS_TITLE)).toHaveLength(1)
  expect(optionsOf(world, SETTINGS_TITLE)).toEqual([...settingLines(config).map((line) => line.label), DONE_LABEL])
  expect(world.pi.unexpected).toEqual([])
})

test("Done and Escape both leave without writing or saying anything", async () => {
  const world = await configuredWorld({})
  const before = await configText(world)
  const done = await settingsScreen(world, [leaveScreen])
  const escaped = await settingsScreen(world, [{ method: "select", title: SETTINGS_TITLE, answer: pressEscape }])
  expect(await configText(world)).toBe(before)
  expect(done.notifications).toEqual([])
  expect(escaped.notifications).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

test("the screen shows each cutoff with where it comes from, and the Jev default", async () => {
  const world = await configuredWorld({})
  const { decisionModel } = await storedConfig(world)
  if (decisionModel.provider !== "typesafe") throw new Error("the E2E world uses Jev")
  await rewriteConfig(world, { decisionModel: { ...decisionModel, gateThreshold: 0.3 } })
  await settingsScreen(world, [leaveScreen])
  const labels = settingLines(await storedConfig(world)).map((line) => line.label)
  expect(optionsOf(world, SETTINGS_TITLE)).toEqual([...labels, DONE_LABEL])
  expect(world.pi.unexpected).toEqual([])
})

test("stopping pi while the screen has a question open ends it without an error", async () => {
  const world = await configuredWorld({})
  await world.pi.beginCommand(
    `/${MEMORY_SETUP_COMMAND}`,
    [pickLine("Context budget:"), { method: "input", title: "Context budget", answer: { open: true } }],
    dialogTitled("Context budget ("),
  )
  await world.stop()
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
  expect(world.pi.stderr).toBe("")
})
