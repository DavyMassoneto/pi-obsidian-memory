import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { localEmbeddingConfiguration, localEmbeddingPolicy } from "#src/domain"
import { NEEDS_FIXING_MARK } from "#src/pi"
import { embeddingFingerprint } from "#src/services"
import { QUERY_NOT_EMBEDDED } from "#src/usecases"
import {
  CAT_QUERY,
  catDays,
  configuredWorld,
  foundLine,
  noteWithId,
  searchAnswer,
  vectorsOnDisk,
  weatherSentences,
  writeVaultFile,
} from "#test-helpers"

const localGeneration = {
  fingerprint: embeddingFingerprint(localEmbeddingConfiguration),
  dimensions: localEmbeddingPolicy.dimensions,
}

test("the first search embeds all 40 notes, belonging to the local provider, and a deleted note's vector is dropped", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  for (let number = 1; number <= 40; number++) {
    await writeVaultFile(globalVault, `notes/Note ${number}.md`, noteWithId(number, `Plain words ${number}.`, []))
  }
  expect((await searchAnswer(world, "plain words")).isError).toBe(false)
  const full = await vectorsOnDisk(world)
  expect(full.coverage).toEqual({ generation: localGeneration, embedded: 40, current: 40 })
  expect(full.chunks).toBe(40)
  await rm(join(globalVault, "notes", "Note 3.md"))
  expect((await searchAnswer(world, "plain words")).isError).toBe(false)
  const smaller = await vectorsOnDisk(world)
  expect(smaller.coverage).toEqual({ generation: localGeneration, embedded: 39, current: 39 })
  expect(smaller.chunks).toBe(39)
})

test("a note much longer than the model window is embedded, not refused", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const body = Array.from({ length: 900 }, (_, number) => `Sentence ${number} about the cat and the vacuum cleaner.`)
  await writeVaultFile(world.folders.globalVault, "pets/Long story.md", noteWithId(1, body.join(" "), []))
  expect((await searchAnswer(world, "cat")).isError).toBe(false)
  const state = await vectorsOnDisk(world)
  expect(state.coverage).toEqual({ generation: localGeneration, embedded: 1, current: 1 })
  expect(state.chunks).toBe(1)
})

test("the end of a note longer than the model window is embedded: its last paragraph is found by meaning, its first one alone is not", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  const longPath = "notes/Garden notes.md"
  await writeVaultFile(globalVault, longPath, noteWithId(1, `${weatherSentences(56)} ${catDays(30)}`, []))
  await writeVaultFile(globalVault, "notes/Weather notes.md", noteWithId(2, weatherSentences(56), []))
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer).toEqual({ text: foundLine(longPath, NEEDS_FIXING_MARK), isError: false })
})

test("a query longer than the model window is not embedded and the answer uses words only", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, "home/Hoover.md", noteWithId(1, "Hoover.", []))
  const answer = await searchAnswer(
    world,
    Array.from({ length: 120 }, (_, number) => `Clause ${number} about the hoover.`).join(" "),
  )
  expect(answer).toEqual({ text: `${foundLine("home/Hoover.md")}\n${QUERY_NOT_EMBEDDED}`, isError: false })
})

test("only the statement is needed for a note to be found by meaning", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const path = "pets/Our cat hides from the vacuum cleaner.md"
  await writeVaultFile(world.folders.globalVault, path, noteWithId(1, "Details are in the other note.", []))
  const answer = await searchAnswer(world, "kitty frightened by hoover noise")
  expect(answer).toEqual({ text: foundLine(path), isError: false })
})
