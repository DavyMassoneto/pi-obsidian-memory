import { expect, test } from "vitest"

import {
  CYCLE_FACTS,
  compactionsIn,
  cycleWorld,
  ExtensionErrorSchema,
  OBSERVATION_LINE,
  observationEntriesIn,
  recordsOf,
  waitForObservations,
} from "#test-helpers"

test("a resumed session and a forked one keep the observations of their own branch and compact from them", async () => {
  const world = await cycleWorld({ observer: { chunkTokens: 300 }, compaction: { tailTokens: 150 } })
  for (const fact of CYCLE_FACTS) await world.pi.prompt(fact, [])
  const original = await world.pi.sessionFile()
  const observed = await waitForObservations(original, 1)
  await world.pi.prompt("Reply with the single word ACK.", [])

  await world.pi.newSession()
  const other = await world.pi.sessionFile()
  expect(other).not.toBe(original)
  await world.pi.switchSession(original)
  expect(await world.pi.sessionFile()).toBe(original)
  await world.pi.compact()
  const resumed = (await compactionsIn(original)).at(-1)
  if (!resumed) throw new Error("the resumed session has no compaction entry")
  expect(resumed.fromHook).toBe(true)
  expect(resumed.summary).toMatch(OBSERVATION_LINE)
  expect((await observationEntriesIn(original)).length).toBe(observed.length)

  const forkPoints = await world.pi.forkEntryIds()
  const last = forkPoints.at(-1)
  if (!last) throw new Error("the session offers no fork point")
  await world.pi.fork(last)
  const forked = await world.pi.sessionFile()
  expect(forked).not.toBe(original)
  const inherited = await observationEntriesIn(forked)
  expect(inherited.length).toBeGreaterThan(0)
  await world.pi.compact()
  const forkedCompaction = (await compactionsIn(forked)).at(-1)
  if (!forkedCompaction) throw new Error("the forked session has no compaction entry")
  expect(forkedCompaction.fromHook).toBe(true)
  expect(forkedCompaction.summary).toMatch(OBSERVATION_LINE)
  expect((await observationEntriesIn(original)).length).toBe(observed.length)
  expect(world.pi.unexpected).toEqual([])
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
})
