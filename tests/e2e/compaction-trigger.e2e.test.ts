import { expect, test } from "vitest"

import {
  compactionsIn,
  ExtensionErrorSchema,
  isResume,
  recordsOf,
  TRIGGER_PROMPT,
  triggerWorld,
  waitForResumedRun,
  waitForSettledRun,
} from "#test-helpers"

test("crossing the threshold mid-run compacts between turns and resumes the run with a hidden message", async () => {
  const world = await triggerWorld()

  await world.pi.prompt(TRIGGER_PROMPT, [])
  const file = await world.pi.sessionFile()
  const timeline = await waitForResumedRun(file)
  await waitForSettledRun(world)

  const compactions = await compactionsIn(file)
  expect(compactions.length).toBeGreaterThan(0)
  expect(compactions.some((compaction) => compaction.fromHook)).toBe(true)
  const firstCompaction = timeline.findIndex((entry) => entry.type === "compaction")
  const resumes = timeline.filter(isResume)
  expect(resumes.length).toBeGreaterThan(0)
  for (const resume of resumes) expect(resume.display).toBe(false)
  expect(timeline.findIndex(isResume)).toBeGreaterThan(firstCompaction)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
