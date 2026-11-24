import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import Type, { type Static } from "typebox"

import { RESUME_TYPE } from "#src/usecases"
import { configuredWorld } from "./e2e-config.ts"
import { entriesIn } from "./e2e-observation-cycle.ts"
import type { E2eWorld } from "./e2e-world.ts"

const TRIGGER_FILE_BYTES = 6000

const TRIGGER_CYCLE = { compaction: { atContextTokens: 1, tailTokens: 200 }, observer: { chunkTokens: 300 } }

export const TRIGGER_PROMPT = "Read a.txt, then b.txt, then reply DONE."

const TIMELINE_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  id: Type.String(),
  customType: Type.Optional(Type.String()),
  message: Type.Optional(Type.Object({ role: Type.String() })),
})

export type TimelineEntry = Static<typeof TIMELINE_ENTRY_SCHEMA>

function fileOf(topic: string): string {
  const line = `The warehouse keeps the crates of ${topic} on a numbered shelf until the courier collects them.\n`
  return line.repeat(Math.ceil(TRIGGER_FILE_BYTES / line.length))
}

async function withTriggerFiles(world: E2eWorld): Promise<E2eWorld> {
  await writeFile(join(world.folders.cwd, "a.txt"), fileOf("apples"))
  await writeFile(join(world.folders.cwd, "b.txt"), fileOf("bananas"))
  return world
}

export async function triggerWorld(): Promise<E2eWorld> {
  return withTriggerFiles(
    await configuredWorld({
      session: "saved",
      tools: ["read"],
      cycle: TRIGGER_CYCLE,
    }),
  )
}

export async function refusedCompactionWorld(): Promise<E2eWorld> {
  return withTriggerFiles(
    await configuredWorld({
      session: "saved",
      tools: ["read"],
      cycle: {
        ...TRIGGER_CYCLE,
        observer: { ...TRIGGER_CYCLE.observer, model: { provider: "unregistered", id: "observer" } },
      },
    }),
  )
}

export function timelineIn(file: string): Promise<TimelineEntry[]> {
  return entriesIn(file, TIMELINE_ENTRY_SCHEMA)
}

export function isResume(entry: TimelineEntry): boolean {
  return entry.type === "custom_message" && entry.customType === RESUME_TYPE
}
