import { expect, test } from "vitest"

import { JOURNEY_HEADING, OBSERVATION_SEPARATOR } from "#src/domain"
import { CONSOLIDATION_SAVED } from "#src/pi"
import {
  CONSOLIDATION_WAIT_MS,
  compactionsIn,
  consolidatedEntriesIn,
  consolidationWorld,
  ExtensionErrorSchema,
  expectRuleNote,
  noteMentioning,
  noticesStarting,
  RULE_CONVERSATION,
  recordsOf,
  TASK_MARKER,
  vaultNotes,
  waitForConsolidationIdle,
  waitForConsolidations,
  waitForRuleNote,
} from "#test-helpers"

test("a stated project rule becomes a note in the existing folder, the task does not, and the journey and tombstones appear in the session", async () => {
  const world = await consolidationWorld()
  const file = await world.pi.sessionFile()

  for (const message of RULE_CONVERSATION) await world.pi.prompt(message, [])
  await waitForRuleNote(world)
  await waitForConsolidations(file, 1, CONSOLIDATION_WAIT_MS)
  await waitForConsolidationIdle(world)

  await expectRuleNote(world)
  expect(await noteMentioning(world, TASK_MARKER)).toEqual([])
  expect(noticesStarting(world, CONSOLIDATION_SAVED).length).toBeGreaterThan(0)
  const entries = await consolidatedEntriesIn(file)
  expect(entries.some((entry) => entry.data.journey.trim().length > 0)).toBe(true)
  const tombstoned = entries.flatMap((entry) => entry.data.observationIds)
  expect(tombstoned.length).toBeGreaterThan(0)

  await world.pi.compact()

  const compaction = (await compactionsIn(file)).at(-1)
  if (!compaction) throw new Error("the session has no compaction entry")
  expect(compaction.fromHook).toBe(true)
  expect(compaction.summary).toContain(JOURNEY_HEADING)
  for (const id of tombstoned) expect(compaction.summary).not.toContain(`\n${id}${OBSERVATION_SEPARATOR}`)
  await waitForConsolidationIdle(world)
  expect(await noteMentioning(world, TASK_MARKER)).toEqual([])
  expect((await vaultNotes(world.folders.globalVault)).length).toBe(0)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
