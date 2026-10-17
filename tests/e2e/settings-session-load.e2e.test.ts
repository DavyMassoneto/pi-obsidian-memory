import { expect, test } from "vitest"

import { RELEVANT_LOAD_ERROR_PREFIX } from "#src/pi"
import { SESSION_LOAD_FAILED } from "#src/usecases"
import {
  callsOf,
  configuredWorld,
  endOf,
  leaveScreen,
  NotifySchema,
  pickLine,
  recordsOf,
  settingsScreen,
  storedConfig,
  toolCallPrompt,
} from "#test-helpers"

const statement = "Use pnpm, never npm"

test("saving a setting while the session-start load is running shows no load failure", async () => {
  const world = await configuredWorld({})
  const add = {
    scope: "global",
    folder: "tools",
    statement,
    type: "rule",
    body: "Every install and script runs with pnpm.",
    dontForget: true,
  }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(callsOf(added, "memory_add")).toBe(1)
  expect(endOf(added, "memory_add").isError).toBe(false)
  await world.restart()
  await settingsScreen(world, [
    pickLine("Max note body:"),
    { method: "input", title: "Max note body", answer: { value: "7" } },
    leaveScreen,
  ])
  expect((await storedConfig(world)).limits.maxBodyChars).toBe(7)
  await world.pi.prompt("Reply with the single word ok.", [])
  const failures = recordsOf(NotifySchema, world.pi.lines)
    .map((notice) => notice.message)
    .filter((message) => message.startsWith(SESSION_LOAD_FAILED) || message.startsWith(RELEVANT_LOAD_ERROR_PREFIX))
  expect(failures).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})
