import { expect } from "vitest"

import { MEMORY_SEARCH_TOOL_NAME, SEARCH_FIELD_SEPARATOR } from "#src/pi"
import { toolText } from "./e2e-records.ts"
import { callsOf, endOf, toolCallPrompt } from "./e2e-turns.ts"
import type { E2eWorld } from "./e2e-world.ts"

export const CAT_PATH = "pets/Our cat hides from the vacuum cleaner.md"
export const CAT_BODY = "Whenever the vacuum cleaner starts, the cat runs under the bed."
export const CAT_QUERY = "kitty frightened by hoover noise"

export interface SearchAnswer {
  text: string
  isError: boolean
}

export function searchPrompt(query: string): string {
  return toolCallPrompt(MEMORY_SEARCH_TOOL_NAME, JSON.stringify({ vault: "global", query }))
}

export async function searchAnswer(world: Pick<E2eWorld, "pi">, query: string): Promise<SearchAnswer> {
  const turn = await world.pi.prompt(searchPrompt(query), [])
  expect(turn.toolStarts.map((start) => start.toolName)).toEqual([MEMORY_SEARCH_TOOL_NAME])
  expect(callsOf(turn, MEMORY_SEARCH_TOOL_NAME)).toBe(1)
  const end = endOf(turn, MEMORY_SEARCH_TOOL_NAME)
  return { text: toolText(end), isError: end.isError }
}

export function foundLine(path: string, ...marks: string[]): string {
  return ["global", path, "rule", ...marks].join(SEARCH_FIELD_SEPARATOR)
}
