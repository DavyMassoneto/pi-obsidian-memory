import { expect, test } from "vitest"

import {
  MemorySessionKeeper,
  memoryAddTool,
  memoryArchiveTool,
  memoryGetTool,
  memorySearchTool,
  memorySucceedTool,
  memoryUpdateTool,
  registerExtension,
} from "#src/pi"
import { loadWithRegistrar, useTempFolder } from "#test-helpers"

const paths = { configPath: "config.json", indexPath: "index" }

test("each tool reaches pi's tool registration under its own name", async () => {
  const keeper = new MemorySessionKeeper()

  const loaded = await loadWithRegistrar((registrar) => {
    registrar.registerAddTool(memoryAddTool(paths, keeper))
    registrar.registerSearchTool(memorySearchTool(paths, keeper))
    registrar.registerGetTool(memoryGetTool(paths, keeper))
    registrar.registerUpdateTool(memoryUpdateTool(paths, keeper))
    registrar.registerArchiveTool(memoryArchiveTool(paths, keeper))
    registrar.registerSucceedTool(memorySucceedTool(paths, keeper))
  })

  expect(loaded.tools).toEqual([
    "memory_add",
    "memory_search",
    "memory_get",
    "memory_update",
    "memory_archive",
    "memory_succeed",
  ])
})

test("the observation cycle listens to turn_end, agent_start and session_shutdown", async () => {
  const agentDir = await useTempFolder()

  const loaded = await loadWithRegistrar((registrar) => registerExtension(registrar, agentDir))

  expect([...loaded.handlers.keys()]).toEqual(expect.arrayContaining(["turn_end", "agent_start", "session_shutdown"]))
})

test("the extension handles session_before_compact", async () => {
  const agentDir = await useTempFolder()

  const loaded = await loadWithRegistrar((registrar) => registerExtension(registrar, agentDir))

  expect([...loaded.handlers.keys()]).toContain("session_before_compact")
})

test("a command reaches pi's command registration under its name", async () => {
  const loaded = await loadWithRegistrar((registrar) => {
    registrar.registerCommand("memory-x", { description: "d", handler: async () => undefined })
  })

  expect(loaded.commands).toEqual(["memory-x"])
})
