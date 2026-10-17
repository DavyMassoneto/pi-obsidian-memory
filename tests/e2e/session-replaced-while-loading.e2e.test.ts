import { test } from "vitest"

import { STATUS_SEARCHING } from "#src/pi"
import {
  configuredWorld,
  expectReplacementSession,
  loadingWorld,
  newSessionMeasured,
  READY_PROMPT,
  statusSet,
  toolCallPrompt,
  toolStarted,
} from "#test-helpers"

test("a new session started while the startup memory load runs keeps pi alive and loads its own memory", async () => {
  const world = await loadingWorld({})
  const from = world.pi.lines.length
  await world.pi.newSession()
  await expectReplacementSession(world, from)
})

test("resuming a saved session while the memory load of a new session runs keeps pi alive and loads its own memory", async () => {
  const world = await loadingWorld({ session: "saved" })
  await world.pi.prompt(READY_PROMPT, [])
  const sessionFile = await world.pi.sessionFile()
  await world.pi.newSession()
  const from = world.pi.lines.length
  await world.pi.switchSession(sessionFile)
  await expectReplacementSession(world, from)
})

test("a new session started while the per-message memory search runs keeps pi alive", async () => {
  const world = await configuredWorld({})
  const from = world.pi.lines.length
  await world.pi.beginPrompt("What do you remember about my favourite colour and my editor?")
  await world.pi.waitFor(statusSet(STATUS_SEARCHING.key), from)
  await newSessionMeasured(world, "search in flight")
})

test("a new session started while the shell-edit guard asks Jev keeps pi alive", async () => {
  const world = await configuredWorld({ tools: ["bash"] })
  const from = world.pi.lines.length
  await world.pi.beginPrompt(toolCallPrompt("bash", JSON.stringify({ command: "echo hello" })))
  await world.pi.waitFor(toolStarted(), from)
  await newSessionMeasured(world, "shell guard in flight")
})
