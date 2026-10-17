import { writeFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { DONE_LABEL, MEMORY_SETUP_COMMAND, NONE_WORD, SAVED, SETTINGS_TITLE, settingLines } from "#src/pi"
import {
  configText,
  configuredWorld,
  dialogsTitled,
  dialogTitled,
  leaveScreen,
  pickLine,
  pressEscape,
  settingsScreen,
  storedConfig,
  typing,
  withGateCutoff,
} from "#test-helpers"

test.each([
  {
    name: "a threshold",
    line: "Gate cutoff",
    typed: "0.4",
    section: "decisionModel",
    expected: { gateThreshold: 0.4 },
  },
  {
    name: "the other threshold",
    line: "Relevance cutoff",
    typed: "0",
    section: "decisionModel",
    expected: { relevanceThreshold: 0 },
  },
  {
    name: "the context budget",
    line: "Context budget",
    typed: "500",
    section: "context",
    expected: { budgetChars: 500 },
  },
  { name: "the note body limit", line: "Max note body", typed: "7", section: "limits", expected: { maxBodyChars: 7 } },
  {
    name: "the statement limit",
    line: "Max statement",
    typed: "9",
    section: "limits",
    expected: { maxStatementChars: 9 },
  },
  {
    name: "the notes per folder",
    line: "Max notes per folder",
    typed: "30",
    section: "limits",
    expected: { maxNotesPerFolder: 30 },
  },
] as const)("typing $name writes it", async ({ line, typed, section, expected }) => {
  const world = await configuredWorld({})
  await settingsScreen(world, [pickLine(`${line}:`), typing(line, typed), leaveScreen])
  expect((await storedConfig(world))[section]).toMatchObject(expected)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  {
    name: "a threshold that is not a number",
    line: "Gate cutoff",
    typed: "abc",
    reason: "must be a number from 0 to 1",
  },
  { name: "a threshold above 1", line: "Relevance cutoff", typed: "1.5", reason: "must be a number from 0 to 1" },
  { name: "a budget of zero", line: "Context budget", typed: "0", reason: "must be a whole number of 1 or more" },
  {
    name: "a limit that is not whole",
    line: "Max note body",
    typed: "2.5",
    reason: "must be a whole number of 1 or more",
  },
])("$name is refused with its reason, the file stays as it was and the screen comes back", async (refusal) => {
  const world = await configuredWorld({})
  const before = await configText(world)
  const turn = await settingsScreen(world, [
    pickLine(`${refusal.line}:`),
    typing(refusal.line, refusal.typed),
    leaveScreen,
  ])
  expect(turn.notifications.map((notice) => [notice.notifyType, notice.message.includes(refusal.reason)])).toEqual([
    ["error", true],
  ])
  expect(await configText(world)).toBe(before)
  expect(dialogsTitled(world, SETTINGS_TITLE)).toHaveLength(2)
  expect(world.pi.unexpected).toEqual([])
})

test("an empty answer or Escape on a number keeps the current value and says nothing", async () => {
  const world = await configuredWorld({})
  const text = await withGateCutoff(world)
  const turn = await settingsScreen(world, [
    pickLine("Gate cutoff:"),
    typing("Gate cutoff", ""),
    pickLine("Gate cutoff:"),
    { method: "input", title: "Gate cutoff", answer: pressEscape },
    leaveScreen,
  ])
  expect(await configText(world)).toBe(text)
  expect(turn.notifications).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})

test("typing none clears a cutoff", async () => {
  const world = await configuredWorld({})
  await withGateCutoff(world)
  const turn = await settingsScreen(world, [pickLine("Gate cutoff:"), typing("Gate cutoff", NONE_WORD), leaveScreen])
  expect(turn.notifications.map((notice) => [notice.notifyType, notice.message])).toEqual([
    ["info", `${SAVED} gate cutoff is now not set.`],
  ])
  expect((await storedConfig(world)).decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  expect(world.pi.unexpected).toEqual([])
})

test("a file edited while a question is open is a conflict: nothing is overwritten and the screen reloads", async () => {
  const world = await configuredWorld({})
  await world.pi.beginCommand(
    `/${MEMORY_SETUP_COMMAND}`,
    [pickLine("Context budget:"), { method: "input", title: "Context budget", answer: { open: true } }, leaveScreen],
    dialogTitled("Context budget ("),
  )
  const edited = JSON.stringify({ ...(await storedConfig(world)), context: { budgetChars: 99 } })
  await writeFile(world.folders.configPath, edited)
  world.pi.answerOpen({ value: "500" })
  const turn = await world.pi.endCommand()
  expect(turn.notifications.map((notice) => [notice.notifyType, notice.message.includes("changed on disk")])).toEqual([
    ["error", true],
  ])
  expect(await configText(world)).toBe(edited)
  const labels = settingLines(await storedConfig(world)).map((line) => line.label)
  expect(dialogsTitled(world, SETTINGS_TITLE).at(-1)?.options).toEqual([...labels, DONE_LABEL])
  expect(world.pi.unexpected).toEqual([])
})
