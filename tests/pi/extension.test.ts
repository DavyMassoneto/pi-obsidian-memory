import { expect, test } from "vitest"

import { registerWithFakePi } from "#test-helpers"

test("registers the memory_add tool for explicit requests only", () => {
  const { tools, events } = registerWithFakePi({})

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

  registerWithFakePi(env)

  expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe("1")
})
