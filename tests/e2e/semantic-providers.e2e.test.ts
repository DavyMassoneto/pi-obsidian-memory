import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { MODEL_INVALID } from "#src/pi"
import { QUERY_NOT_EMBEDDED } from "#src/usecases"
import {
  DAMAGED_CONFIG_TEXT,
  downloadLocalModel,
  foundLine,
  GOOGLE_EMBEDDINGS,
  HOOVER_PATH,
  modelFilesOnDisk,
  OPENAI_EMBEDDINGS,
  offTwice,
  plantDamagedModel,
  rewriteConfig,
  searchAnswer,
  stoppedBeforeAnyNote,
  storedChunks,
  vectorsOnDisk,
  worldWithHooverNote,
  writeProviderKey,
} from "#test-helpers"

test("a remote provider with no key in pi says so, answers with words, and never swaps in the local model", async () => {
  const world = await worldWithHooverNote(GOOGLE_EMBEDDINGS, "shared")
  const answer = await searchAnswer(world, "hoover")
  expect(answer).toEqual({ text: offTwice("no API key for google"), isError: false })
  expect((await vectorsOnDisk(world)).chunks).toBe(0)
  expect(world.pi.unexpected).toEqual([])
})

test("an empty API key stored in pi counts as no API key", async () => {
  const world = await worldWithHooverNote(OPENAI_EMBEDDINGS, "shared")
  await writeProviderKey(world, "openai", "")
  await world.restart()
  const answer = await searchAnswer(world, "hoover")
  expect(answer).toEqual({ text: offTwice("no API key for openai"), isError: false })
  expect((await vectorsOnDisk(world)).chunks).toBe(0)
})

test("a damaged local model is not used, not downloaded again, and nothing is asked", async () => {
  const world = await worldWithHooverNote(null, "fresh")
  await downloadLocalModel(world)
  await world.pi.stop()
  const configPath = await plantDamagedModel(world)
  const before = await modelFilesOnDisk(world)
  await world.restart()
  const answer = await searchAnswer(world, "hoover")
  expect(answer).toEqual({ text: offTwice(MODEL_INVALID), isError: false })
  expect(await modelFilesOnDisk(world)).toEqual(before)
  expect(await readFile(configPath, "utf8")).toBe(DAMAGED_CONFIG_TEXT)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  ["openai", OPENAI_EMBEDDINGS, "sk-e2e-dummy-key"],
  ["google", GOOGLE_EMBEDDINGS, "google-e2e-dummy-key"],
] as const)(
  "a %s key taken from pi is used, and the remote refusing it leaves a words-only answer",
  async (provider, embeddings, key) => {
    const world = await worldWithHooverNote(embeddings, "shared")
    await writeProviderKey(world, provider, key)
    await world.restart()
    const answer = await searchAnswer(world, "hoover")
    expect(answer).toEqual({
      text: `${foundLine(HOOVER_PATH)}\n${stoppedBeforeAnyNote("unavailable", 1)}\n${QUERY_NOT_EMBEDDED}`,
      isError: false,
    })
    expect((await vectorsOnDisk(world)).chunks).toBe(0)
  },
)

test("switching to a provider that refuses the key keeps the local vectors, and the answer uses words only", async () => {
  const world = await worldWithHooverNote(null, "shared")
  expect(await searchAnswer(world, "hoover")).toEqual({ text: foundLine(HOOVER_PATH), isError: false })
  await world.pi.stop()
  const local = await storedChunks(world)
  expect(local).toHaveLength(1)
  await rewriteConfig(world, { embeddings: OPENAI_EMBEDDINGS })
  await writeProviderKey(world, "openai", "sk-e2e-dummy-key")
  await world.restart()
  const answer = await searchAnswer(world, "hoover")
  expect(answer).toEqual({
    text: `${foundLine(HOOVER_PATH)}\n${stoppedBeforeAnyNote("unavailable", 1)}\n${QUERY_NOT_EMBEDDED}`,
    isError: false,
  })
  await world.pi.stop()
  expect(await storedChunks(world)).toEqual(local)
})
