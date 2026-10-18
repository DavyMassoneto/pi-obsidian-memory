import { readFile } from "node:fs/promises"

import Type from "typebox"

import { CURSOR_TYPE } from "#src/pi"
import { recordOf } from "./e2e-records.ts"
import { type E2eWorld, e2eWorld } from "./e2e-world.ts"
import type { WorldOptions } from "./e2e-world-types.ts"

const CursorLineSchema = Type.Object({ type: Type.Literal("custom"), customType: Type.Literal(CURSOR_TYPE) })

export const PLAIN_PROMPT = "Reply with only OK."

export function cadenceWorld(options: Partial<WorldOptions>): Promise<E2eWorld> {
  return e2eWorld({
    memory: "configured",
    tools: [],
    modelCache: "shared",
    capture: "after-each-turn",
    session: "saved",
    ...options,
  })
}

export async function cursorsIn(sessionFile: string): Promise<number> {
  const text = await readFile(sessionFile, "utf8")
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .filter((line) => recordOf(CursorLineSchema, line)).length
}

export async function untilCursors(sessionFile: string, count: number): Promise<void> {
  const deadline = Date.now() + 180_000
  while ((await cursorsIn(sessionFile)) < count) {
    if (Date.now() > deadline) throw new Error(`no ${count} cursor in ${sessionFile}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

export async function promptTimes(world: E2eWorld, count: number, prompt: string): Promise<void> {
  for (let index = 0; index < count; index++) await world.pi.prompt(prompt, [])
}
