import { expect, test } from "vitest"

import { JOURNEY_HEADING, OBSERVATION_SEPARATOR } from "#src/domain"
import { CONSOLIDATION_SAVED } from "#src/pi"
import {
  CONSOLIDATION_WAIT_MS,
  compactionsIn,
  consolidatedEntriesIn,
  consolidationWorld,
  ExtensionErrorSchema,
  expectEnglishNote,
  expectRuleNote,
  NEXT_TURN_PROMPT,
  noteMentioning,
  noticesStarting,
  PORTUGUESE_CONVERSATION,
  RULE_CONVERSATION,
  recordsOf,
  STATED_SECRET,
  TASK_MARKER,
  vaultNotes,
  waitForConsolidationIdle,
  waitForConsolidations,
  waitForNoteMentioning,
  waitForObservations,
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

test("a rule and a secret stated in Portuguese become English notes that keep the secret as written", async () => {
  const world = await consolidationWorld()
  const file = await world.pi.sessionFile()

  for (const message of PORTUGUESE_CONVERSATION) await world.pi.prompt(message, [])
  await waitForObservations(file, 1)
  await world.pi.prompt(NEXT_TURN_PROMPT, [])
  const withSecret = await waitForNoteMentioning(world, STATED_SECRET)
  await waitForConsolidationIdle(world)

  for (const note of withSecret) expectEnglishNote(note)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
