import { expect, test } from "vitest"

import { COMPACTION_DONE, COMPACTION_NOT_DONE, COMPACTION_STARTED } from "#src/pi"
import { NOT_OBSERVED } from "#src/usecases"
import {
  compactionsIn,
  ExtensionErrorSchema,
  isResume,
  NotifySchema,
  noticesStarting,
  readsInSeparateTurns,
  recordsOf,
  refusedCompactionWorld,
  SettledSchema,
  TRIGGER_PROMPT,
  timelineIn,
  triggerWorld,
} from "#test-helpers"

function expectSingleSettledRun(lines: string[]) {
  expect(recordsOf(SettledSchema, lines)).toEqual([{ type: "agent_settled", aborted: false }])
}

test("crossing the threshold mid-run compacts between turns and continues the same run", async () => {
  const world = await triggerWorld()

  await world.pi.prompt(TRIGGER_PROMPT, [])
  const file = await world.pi.sessionFile()

  const timeline = await timelineIn(file)
  const compactions = await compactionsIn(file)
  expect(readsInSeparateTurns(timeline)).toBe(true)
  expect(compactions.length).toBeGreaterThan(0)
  expect(compactions.some((compaction) => compaction.fromHook)).toBe(true)
  expect(timeline.filter(isResume)).toEqual([])
  expectSingleSettledRun(world.pi.lines)
  const firstCompaction = timeline.findIndex((entry) => entry.type === "compaction")
  const lastAssistant = timeline.findLastIndex((entry) => entry.message?.role === "assistant")
  expect(lastAssistant).toBeGreaterThan(firstCompaction)
  expect((await world.pi.lastAssistantText())?.trim()).toContain("DONE")
  expect(noticesStarting(world, COMPACTION_STARTED).length).toBeGreaterThan(0)
  expect(noticesStarting(world, COMPACTION_DONE).length).toBeGreaterThan(0)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})

test("when memory cannot build the block yet, it says so and the run finishes without an abort", async () => {
  const world = await refusedCompactionWorld()

  await world.pi.prompt(TRIGGER_PROMPT, [])
  const file = await world.pi.sessionFile()

  expect(await compactionsIn(file)).toEqual([])
  expect((await timelineIn(file)).filter(isResume)).toEqual([])
  expectSingleSettledRun(world.pi.lines)
  const warnings = recordsOf(NotifySchema, world.pi.lines).filter((notice) => notice.notifyType === "warning")
  expect(warnings.map((notice) => notice.message)).toContain(`${COMPACTION_NOT_DONE} ${NOT_OBSERVED}`)
  expect((await world.pi.lastAssistantText())?.trim()).toContain("DONE")
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
