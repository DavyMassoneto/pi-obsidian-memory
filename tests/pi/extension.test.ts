import { join } from "node:path"

import { expect, test } from "vitest"

import { registerExtension } from "#/pi"
import type { MemoryAddTool } from "#/pi/memory-add"

test("registers the memory_add tool for explicit requests only", () => {
  const tools: MemoryAddTool[] = []
  const events: string[] = []

  registerExtension(
    { registerTool: (tool) => tools.push(tool), on: (event) => events.push(event) },
    join("C:", "agent"),
  )

  expect(tools).toEqual([
    expect.objectContaining({
      name: "memory_add",
      description: "Use only when the user explicitly asks to remember something.",
    }),
  ])
  expect(events).toEqual(["session_start"])
})
