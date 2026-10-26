import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { setTimeout as delay } from "node:timers/promises"

import Type, { type Static } from "typebox"

import { RESUME_TYPE } from "#src/usecases"
import { configuredWorld } from "./e2e-config.ts"
import { entriesIn, OBSERVATION_WAIT_MS } from "./e2e-observation-cycle.ts"
import { recordsOf, SettledSchema } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

const TRIGGER_FILE_BYTES = 6000

export const TRIGGER_PROMPT = "Read a.txt, then b.txt, then reply DONE."

const TIMELINE_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  id: Type.String(),
  customType: Type.Optional(Type.String()),
  display: Type.Optional(Type.Boolean()),
  message: Type.Optional(Type.Object({ role: Type.String() })),
})

export type TimelineEntry = Static<typeof TIMELINE_ENTRY_SCHEMA>

function fileOf(topic: string): string {
  const line = `The warehouse keeps the crates of ${topic} on a numbered shelf until the courier collects them.\n`
  return line.repeat(Math.ceil(TRIGGER_FILE_BYTES / line.length))
}

export async function triggerWorld(): Promise<E2eWorld> {
  const world = await configuredWorld({
    session: "saved",
    compactsSmallSessions: true,
    tools: ["read"],
    cycle: { compaction: { atContextTokens: 1, tailTokens: 200 }, observer: { chunkTokens: 300 } },
  })
  await writeFile(join(world.folders.cwd, "a.txt"), fileOf("apples"))
  await writeFile(join(world.folders.cwd, "b.txt"), fileOf("bananas"))
  return world
}

export function timelineIn(file: string): Promise<TimelineEntry[]> {
  return entriesIn(file, TIMELINE_ENTRY_SCHEMA)
}

export function isResume(entry: TimelineEntry): boolean {
  return entry.type === "custom_message" && entry.customType === RESUME_TYPE
}

export function assistantAfterLastResume(timeline: TimelineEntry[]): boolean {
  const last = timeline.findLastIndex(isResume)
  if (last < 0) return false
  return timeline.slice(last + 1).some((entry) => entry.message?.role === "assistant")
}

export async function waitForResumedRun(file: string): Promise<TimelineEntry[]> {
  const deadline = Date.now() + OBSERVATION_WAIT_MS
  let timeline = await timelineIn(file)
  while (!assistantAfterLastResume(timeline)) {
    if (Date.now() >= deadline)
      throw new Error(`no assistant message after a resume in ${file} after ${OBSERVATION_WAIT_MS} ms`)
    await delay(500)
    timeline = await timelineIn(file)
  }
  return timeline
}

export function waitForSettledRun(world: E2eWorld): Promise<string> {
  return world.pi.waitFor(
    {
      description: "an agent_settled that was not aborted",
      matches: (line) => recordsOf(SettledSchema, [line]).some((settled) => !settled.aborted),
    },
    0,
  )
}
