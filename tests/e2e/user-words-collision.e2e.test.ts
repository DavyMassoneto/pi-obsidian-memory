import { createHash } from "node:crypto"

import { expect, test } from "vitest"

import {
  activeObservations,
  compactionObservations,
  ledgerOf,
  OBSERVATION_SEPARATOR,
  selectPromotion,
} from "#src/domain"
import { COMPACTION_DETAILS_TYPE } from "#src/usecases"
import {
  COLLISION_ACK,
  collisionConsolidationOutcome,
  compactionsIn,
  E2E_MODEL,
  E2E_PROVIDER,
  ExtensionErrorSchema,
  noticePiVersion,
  recordsOf,
  userWordsCollisionWorld,
} from "#test-helpers"

test("real Pi compacts and promotes both same-second citations without stealing the earlier tombstone", async () => {
  const world = await userWordsCollisionWorld()
  const { pi, file, first, second, tail, occupiedId, abandonedId, displacedId } = world
  const ids = [occupiedId, displacedId]
  expect(await pi.sessionFile()).toBe(file)
  const prefix = ledgerOf(world.seeded)
  const prior = activeObservations(prefix)
  expect(prior.map(({ id, sources }) => [id, sources])).toEqual([[occupiedId, [first]]])
  expect(prefix.consolidated).toEqual(new Set([abandonedId]))
  expect(prefix.used).toEqual(new Set([occupiedId, abandonedId]))
  expect(Math.floor(world.timestamps[0] / 1000)).toBe(Math.floor(world.timestamps[1] / 1000))
  console.log(
    JSON.stringify({
      nativeSources: [first, second],
      persistedMessageTimestamps: world.timestamps,
      seededOwner: world.firstWords,
      seededTombstone: world.ghost,
      nativeTail: { id: tail, timestamp: world.tailTimestamp },
      before: { activeId: occupiedId, reservedId: abandonedId },
      piVersion: await noticePiVersion(),
    }),
  )

  await pi.prompt(COLLISION_ACK, [])
  expect(world.chatRuns()).toMatchObject([{ provider: E2E_PROVIDER, model: E2E_MODEL, stopReason: "stop" }])
  await world.configure(second)
  await pi.compact()
  const firstCompaction = (await compactionsIn(file)).at(-1)
  if (!firstCompaction) throw new Error("Pi did not write the first compaction")
  expect(firstCompaction).toMatchObject({
    fromHook: true,
    details: { type: COMPACTION_DETAILS_TYPE },
    firstKeptEntryId: tail,
  })
  const before = world.history()
  const beforeLedger = ledgerOf(before)
  const pair = compactionObservations(
    beforeLedger,
    before.findIndex(({ id }) => id === tail),
  )
  expect(pair.map(({ id, sources }) => [id, sources])).toEqual([
    [occupiedId, [first]],
    [displacedId, [second]],
  ])
  expect(pair.slice(0, 1)).toEqual(prior)
  expect(activeObservations(beforeLedger)).toEqual(expect.arrayContaining(pair))
  expect(selectPromotion(beforeLedger, 1)).toEqual(pair)
  const flowed = before.filter((record) => record.kind === "user-words" && record.data.entryId === second)
  expect(flowed).toHaveLength(1)
  expect(beforeLedger.consolidated).toEqual(new Set([abandonedId]))
  const citations = pair.map(({ id, content }) => `${id}${OBSERVATION_SEPARATOR}${content}`)
  const lines = (summary: string) => summary.split("\n").filter((line) => citations.includes(line))
  const citationHash = (summary: string) => createHash("sha256").update(lines(summary).join("\n")).digest("hex")
  expect(lines(firstCompaction.summary)).toEqual(citations)
  console.log(
    JSON.stringify({
      firstCompaction: firstCompaction.id,
      fromHook: firstCompaction.fromHook,
      firstKeptEntryId: tail,
      nativeCompanionAdded: flowed[0]?.id,
      promotable: pair.map(({ id, sources }) => ({ id, sources })),
      preservedOwnerIdAndText: true,
      citationSha256: citationHash(firstCompaction.summary),
    }),
  )

  await world.configure(second, 1)
  const from = pi.lines.length
  await pi.prompt(COLLISION_ACK, [])
  expect(world.chatRuns()).toHaveLength(2)
  expect(world.chatRuns().at(-1)).toMatchObject({
    provider: E2E_PROVIDER,
    model: E2E_MODEL,
    stopReason: "stop",
  })
  const consolidated = await collisionConsolidationOutcome(pi, from)
  expect(consolidated).toMatch(/Memory consolidated: 2 observation\(s\)/)
  const after = world.history()
  const tombstones = after.filter((record) => record.kind === "consolidated")
  expect(tombstones.map(({ data }) => data.observationIds)).toEqual([[abandonedId], ids])
  const afterLedger = ledgerOf(after)
  expect(ids.every((id) => afterLedger.used.has(id) && afterLedger.consolidated.has(id))).toBe(true)
  expect(activeObservations(afterLedger).some(({ id }) => ids.includes(id))).toBe(false)

  await world.configure(tail)
  await pi.compact()
  const afterCompactions = await compactionsIn(file)
  const secondCompaction = afterCompactions.at(-1)
  if (!secondCompaction) throw new Error("Pi did not write the second compaction")
  expect(afterCompactions).toHaveLength(2)
  expect(secondCompaction).toMatchObject({ fromHook: true, details: { type: COMPACTION_DETAILS_TYPE } })
  expect(secondCompaction.firstKeptEntryId).not.toBe(firstCompaction.firstKeptEntryId)
  const latest = world.history()
  const recompacted = compactionObservations(
    ledgerOf(latest),
    latest.findIndex(({ id }) => id === secondCompaction.firstKeptEntryId),
  )
  expect(recompacted.filter(({ id }) => ids.includes(id))).toEqual(pair)
  expect(lines(secondCompaction.summary)).toEqual(citations)
  expect(recordsOf(ExtensionErrorSchema, pi.lines)).toEqual([])
  expect(pi.unexpected).toEqual([])
  console.log(
    JSON.stringify({
      consolidated,
      realTombstone: tombstones.at(-1)?.id,
      retainedAndPromoted: ids,
      recompaction: secondCompaction.id,
      fromHook: secondCompaction.fromHook,
      firstKeptEntryId: secondCompaction.firstKeptEntryId,
      citationSha256: citationHash(secondCompaction.summary),
      chat: world.chatRuns(),
    }),
  )
})
