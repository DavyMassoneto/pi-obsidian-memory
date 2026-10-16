import { expect, test } from "vitest"

import { disableClaudeCodeAutoMemory } from "#src/pi"

test("turns off Claude Code's own memory for the Claude Code sessions this pi starts", () => {
  const env: NodeJS.ProcessEnv = { PATH: "C:/bin" }

  disableClaudeCodeAutoMemory(env)

  expect(env).toEqual({ PATH: "C:/bin", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" })
})

test("keeps it off even when something turned it on before", () => {
  const env: NodeJS.ProcessEnv = { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "0" }

  disableClaudeCodeAutoMemory(env)

  expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe("1")
})
