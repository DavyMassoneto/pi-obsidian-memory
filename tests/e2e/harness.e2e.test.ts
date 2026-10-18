import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import {
  MEMORY_DOCTOR_COMMAND,
  MEMORY_EXPORT_COMMAND,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  STATUS_SEARCHING,
} from "#src/pi"
import { e2eWorld, extensionPath } from "#test-helpers"

test("our extension's commands are exactly the four memory commands", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  const commands = await world.pi.commands()
  const fromOurExtension = commands
    .filter((command) => command.source === "extension" && command.sourceInfo.path === extensionPath())
    .map((command) => command.name)
  expect(fromOurExtension.sort()).toEqual(
    [MEMORY_DOCTOR_COMMAND, MEMORY_EXPORT_COMMAND, MEMORY_INIT_COMMAND, MEMORY_SETUP_COMMAND].sort(),
  )
})

test("Haiku answers through OmniRoute", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  const turn = await world.pi.prompt("Reply with the single word READY and nothing else.", [])
  expect(turn.disposition).toBe("started")
  expect(turn.aborted).toBe(false)
  expect(await world.pi.lastAssistantText()).toContain("READY")
  console.info(`e2e one Haiku turn: ${JSON.stringify(await world.pi.cost())}`)
})

test("setup and init write both vaults to the config, and a message then starts the memory search and ends with no notice, no error and no unexpected dialog", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const config = await readFile(world.folders.configPath, "utf8")
  expect(config).toContain(JSON.stringify(world.folders.globalVault))
  expect(config).toContain(JSON.stringify(world.folders.projectVault))
  const turn = await world.pi.prompt("Which package manager does this project use?", [])
  expect(turn.disposition).toBe("started")
  expect(turn.aborted).toBe(false)
  expect(turn.statuses.map((status) => status.statusKey)).toContain(STATUS_SEARCHING.key)
  expect(turn.notifications).toEqual([])
  expect(turn.extensionErrors).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})
