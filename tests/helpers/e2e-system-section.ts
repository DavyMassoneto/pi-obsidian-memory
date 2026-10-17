import { readFile } from "node:fs/promises"

import Type from "typebox"

import { MEMORY_BLOCK_SECTION } from "#src/pi"
import { recordOf } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

const SectionsSchema = Type.Record(Type.String(), Type.Union([Type.String(), Type.Null()]))

const SystemEntrySchema = Type.Object({
  type: Type.Literal("message"),
  message: Type.Object({ role: Type.Literal("system"), sections: SectionsSchema }),
})

export async function memorySectionHistory(world: E2eWorld): Promise<(string | null)[]> {
  const text = await readFile(await world.pi.sessionFile(), "utf8")
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      const entry = recordOf(SystemEntrySchema, line)
      if (!entry) return []
      return Object.entries(entry.message.sections)
        .filter(([name]) => name === MEMORY_BLOCK_SECTION)
        .map(([, text]) => text)
    })
}

export async function currentMemorySection(world: E2eWorld): Promise<string> {
  const last = (await memorySectionHistory(world)).at(-1)
  if (typeof last !== "string") throw new Error("the session has no memory section")
  return last
}
