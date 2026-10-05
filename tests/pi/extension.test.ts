import { join } from "node:path"

import { expect, test } from "vitest"

import { type MemoryAddTool, registerExtension } from "#/pi"

function register(env: NodeJS.ProcessEnv) {
  const tools: MemoryAddTool[] = []
  const events: string[] = []

  registerExtension(
    { registerTool: (tool) => tools.push(tool), on: (event) => events.push(event) },
    join("C:", "agent"),
    env,
  )

  return { tools, events }
}

test("registers the memory_add tool for explicit requests only", () => {
  const { tools, events } = register({})

  expect(tools).toEqual([
    expect.objectContaining({
      name: "memory_add",
      description: "Use only when the user explicitly asks to remember something.",
    }),
  ])
  expect(events).toEqual(["session_start"])
})

test("turns off Claude Code's own memory in pi's environment", () => {
  const env: NodeJS.ProcessEnv = {}

  register(env)

  expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe("1")
})
