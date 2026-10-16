import { expect, test } from "vitest"

import {
  MemorySessionKeeper,
  memoryAddTool,
  memoryArchiveTool,
  memoryGetTool,
  memorySearchTool,
  memorySucceedTool,
  memoryUpdateTool,
} from "#src/pi"
import { fakePiContext, loadWithRegistrar, promptEvent, toolCallEvent } from "#test-helpers"

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

test("a command reaches pi's command registration under its name", async () => {
  const loaded = await loadWithRegistrar((registrar) => {
    registrar.registerCommand("memory-x", { description: "d", handler: async () => undefined })
  })

  expect(loaded.commands).toEqual(["memory-x"])
})

test("each handler is subscribed to its own pi event and runs when pi fires it", async () => {
  const fired: string[] = []
  const { context } = fakePiContext("work", {})

  const loaded = await loadWithRegistrar((registrar) => {
    registrar.onSessionStart(async () => void fired.push("session_start"))
    registrar.onBeforeAgentStart(async () => void fired.push("before_agent_start"))
    registrar.onToolCall(async () => void fired.push("tool_call"))
    registrar.onSessionShutdown(() => void fired.push("session_shutdown"))
  })
  await loaded.handlers.get("session_start")?.[0]?.({ type: "session_start", reason: "startup" }, context)
  await loaded.handlers.get("before_agent_start")?.[0]?.(promptEvent("work"), context)
  await loaded.handlers.get("tool_call")?.[0]?.(toolCallEvent("read", { path: "a" }), context)
  await loaded.handlers.get("session_shutdown")?.[0]?.({ type: "session_shutdown", reason: "quit" }, context)

  expect([...loaded.handlers.keys()].sort()).toEqual([
    "before_agent_start",
    "session_shutdown",
    "session_start",
    "tool_call",
  ])
  expect(fired).toEqual(["session_start", "before_agent_start", "tool_call", "session_shutdown"])
})
