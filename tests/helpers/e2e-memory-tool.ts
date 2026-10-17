import { expect } from "vitest"

import { toolText } from "./e2e-records.ts"
import { callsOf, endOf, toolCallPrompt } from "./e2e-turns.ts"
import type { E2eWorld } from "./e2e-world.ts"

export function memoryNote(letter: string) {
  return {
    scope: "global",
    folder: "tools",
    statement: `Note ${letter} says pnpm`,
    type: "rule",
    body: `Body ${letter}.`,
    dontForget: false,
  }
}

export function memoryNoteAt(letter: string) {
  return { vault: "global", path: `tools/Note ${letter} says pnpm.md` }
}

export async function callMemoryToolOnce(world: E2eWorld, tool: string, argumentsJson: string): Promise<void> {
  const turn = await world.pi.prompt(toolCallPrompt(tool, argumentsJson), [])
  expect(turn.toolStarts.map((start) => start.toolName)).toEqual([tool])
  expect(callsOf(turn, tool)).toBe(1)
  const end = endOf(turn, tool)
  expect(end.isError, `${tool} ${argumentsJson}: ${toolText(end)}`).toBe(false)
}
