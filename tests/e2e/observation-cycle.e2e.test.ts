import { expect, test } from "vitest"

import { SUMMARY_LEAD } from "#src/domain"
import { COMPACTION_DETAILS_TYPE } from "#src/usecases"
import {
  CYCLE_FACTS,
  CYCLE_NOTES,
  compactionsIn,
  cycleWorld,
  ExtensionErrorSchema,
  OBSERVATION_LINE,
  observationEntriesIn,
  recordsOf,
  seedCycleNotes,
  sourceIdAfter,
  sourceIdsIn,
  vaultState,
  waitForObservations,
} from "#test-helpers"

test("observations are kept in the session, and a compaction builds the block from them, the memory map and a verbatim tail, saving no note", async () => {
  const world = await cycleWorld({ observer: { chunkTokens: 300 }, compaction: { tailTokens: 150 } })
  await seedCycleNotes(world)
  const seeded = await vaultState(world)
  for (const fact of CYCLE_FACTS) await world.pi.prompt(fact, [])
  const file = await world.pi.sessionFile()
  await waitForObservations(file, 1)

  await world.pi.compact()

  const compaction = (await compactionsIn(file)).at(-1)
  if (!compaction) throw new Error("the session has no compaction entry")
  expect(compaction.fromHook).toBe(true)
  expect(compaction.details?.type).toBe(COMPACTION_DETAILS_TYPE)
  expect(compaction.summary.startsWith(SUMMARY_LEAD)).toBe(true)
  expect(compaction.summary).toContain("## Memory map")
  for (const note of CYCLE_NOTES) expect(compaction.summary).toContain(note.path)
  expect(compaction.summary).toContain("memory_search")
  expect(compaction.summary).toContain("memory_get")
  expect(compaction.summary).toContain("## Observations")
  expect(compaction.summary).toMatch(OBSERVATION_LINE)
  const sourceIds = await sourceIdsIn(file)
  const observations = await observationEntriesIn(file)
  expect(observations.map((entry) => sourceIdAfter(sourceIds, entry.data.coversUpToId))).toContain(
    compaction.firstKeptEntryId,
  )
  expect(await vaultState(world)).toEqual(seeded)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
