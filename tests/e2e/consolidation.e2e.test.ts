import { expect, test } from "vitest"

import { JOURNEY_HEADING, OBSERVATION_SEPARATOR } from "#src/domain"
import { CONSOLIDATION_SAVED, CONSOLIDATOR_STARTED } from "#src/pi"
import {
  CONSOLIDATION_WAIT_MS,
  compactionsIn,
  consolidatedEntriesIn,
  consolidationWorld,
  ExtensionErrorSchema,
  expectEnglishNote,
  expectRuleNote,
  isUserWordsObservation,
  NEXT_TURN_PROMPT,
  noteMentioning,
  noticesStarting,
  observationsBeforeCut,
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
  expect(noticesStarting(world, CONSOLIDATOR_STARTED).length).toBeGreaterThan(0)
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
  const beforeCut = await observationsBeforeCut(file, compaction.firstKeptEntryId)
  const promotedBeforeCut = beforeCut.filter(({ id }) => tombstoned.includes(id))
  const retainedQuotes = promotedBeforeCut.filter(isUserWordsObservation)
  expect(retainedQuotes.length, "tombstoned UserWords before the cut").toBeGreaterThan(0)
  expect(promotedBeforeCut.length, "also tombstoned ordinary observations before the cut").toBeGreaterThan(
    retainedQuotes.length,
  )
  const retainedById = new Map(retainedQuotes.map(({ id, content }) => [id, content]))
  const lines = compaction.summary.split("\n")
  for (const id of tombstoned) {
    const prefix = `${id}${OBSERVATION_SEPARATOR}`
    const quote = retainedById.get(id)
    if (typeof quote === "string") expect(lines).toContain(`${prefix}${quote}`)
    else expect(lines.some((line) => line.startsWith(prefix))).toBe(false)
  }
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
