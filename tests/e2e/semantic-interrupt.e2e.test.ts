import { expect, test } from "vitest"

import { EMBED_BATCH_SIZE } from "#src/usecases"
import {
  beginSearch,
  configuredWorld,
  fillGlobalVault,
  markStoredVector,
  searchAnswer,
  storedChunks,
  waitForStoredChunks,
} from "#test-helpers"

const NOTES = 250
const NOTE_LINE = /^global · notes\/Note \d+\.md · rule$/

test("an interrupted indexing keeps the vectors already stored, and the next search embeds only the rest", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await fillGlobalVault(world, NOTES)
  await beginSearch(world, "plain words")
  await waitForStoredChunks(world, EMBED_BATCH_SIZE)
  await world.pi.newSession()
  await world.pi.stop()
  const kept = await storedChunks(world)
  expect(kept.length).toBeGreaterThanOrEqual(EMBED_BATCH_SIZE)
  expect(kept.length).toBeLessThan(NOTES)
  const [first] = kept
  if (!first) throw new Error("no vector was kept")
  const marker = await markStoredVector(world, first.rowid)
  const marked = await storedChunks(world)
  expect(marked[0]?.vector).toBe(marker)
  await world.restart()
  const answer = await searchAnswer(world, "plain words")
  expect(answer.isError).toBe(false)
  const lines = answer.text.split("\n")
  expect(lines).toHaveLength(NOTES)
  expect(lines.every((line) => NOTE_LINE.test(line))).toBe(true)
  await world.pi.stop()
  const complete = await storedChunks(world)
  expect(complete).toHaveLength(NOTES)
  expect(complete.slice(0, kept.length)).toEqual(marked.slice(0, kept.length))
})
