import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { READ_HINT } from "#src/pi"
import {
  CAT_BODY,
  CAT_PATH,
  CAT_QUERY,
  configuredWorld,
  fileExists,
  foundLine,
  globalIndexFile,
  noteWithId,
  searchAnswer,
  sortedLines,
  writeVaultFile,
} from "#test-helpers"

test("memory_search finds a note by meaning, with no word in common, through the real local model", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(2, "Always pnpm.", []))
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer).toEqual({ text: foundLine(CAT_PATH), isError: false })
})

test("a note found by its words and a note found by meaning are both returned", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  const auditPath = "work/The audit leaves the team frightened.md"
  await writeVaultFile(globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  await writeVaultFile(globalVault, auditPath, noteWithId(3, "Every audit makes the whole team frightened.", []))
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(2, "Always pnpm.", []))
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer.isError).toBe(false)
  expect(sortedLines(answer.text)).toEqual(sortedLines(`${foundLine(CAT_PATH)}\n${foundLine(auditPath)}`))
})

test("deleting the index gives the same results", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  await writeVaultFile(world.folders.globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  const before = await searchAnswer(world, CAT_QUERY)
  expect(before.text).toBe(foundLine(CAT_PATH))
  const index = await globalIndexFile(world)
  expect(await fileExists(index)).toBe(true)
  await rm(index)
  expect(await fileExists(index)).toBe(false)
  const after = await searchAnswer(world, CAT_QUERY)
  expect(after).toEqual(before)
  expect(await fileExists(index)).toBe(true)
})

test("an archived note is never returned by meaning", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  await writeVaultFile(globalVault, CAT_PATH, noteWithId(1, CAT_BODY, []))
  await writeVaultFile(globalVault, `archive/${CAT_PATH}`, noteWithId(2, CAT_BODY, ["archived: 2026-10-01"]))
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer).toEqual({ text: foundLine(CAT_PATH), isError: false })
})

test("editing a note's body makes it findable by its new meaning and no longer by the old one", async () => {
  const world = await configuredWorld({ capture: "at-session-end" })
  const { globalVault } = world.folders
  const path = "misc/Remember this.md"
  await writeVaultFile(globalVault, path, noteWithId(1, CAT_BODY, []))
  expect((await searchAnswer(world, CAT_QUERY)).text).toBe(foundLine(path))
  await writeVaultFile(globalVault, path, noteWithId(1, "The dentist appointment is on Tuesday at nine.", []))
  const renewed = await searchAnswer(world, "doctor for teeth visit")
  expect(renewed.text).toBe(foundLine(path))
  const stale = await searchAnswer(world, CAT_QUERY)
  expect(stale).toEqual({ text: `No notes found in global. ${READ_HINT}`, isError: false })
})
