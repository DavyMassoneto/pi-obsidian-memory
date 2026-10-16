import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { completeBlankMemory } from "#src/usecases"
import {
  blankMemoryFixture,
  expectRegistrationLeaseReleased,
  memoryReadTree,
  noteWithId,
  putCatalogFile,
} from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

test("an empty file becomes a note with a new id, the chosen type and the given body, and nothing else changes", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, vault, blank } = await blankMemoryFixture("")
  const before = await memoryReadTree(vault.path)

  const result = await completeBlankMemory(
    { vault: "global", path: blank.path, expectedHash: blank.rawHash, type: "lesson", body: "Learned this." },
    context,
  )

  expect(result).toMatchObject({ succeeded: true, output: { vault: "global", path: "tools/Blank.md" } })
  const text = await readFile(join(vault.path, "tools/Blank.md"), "utf8")
  expect(text).toMatch(/^---\nid: [0-9A-Z]{26}\ntype: lesson\ncreated: 2026-10-20\nupdated: 2026-10-20\n---\n/)
  expect(text).toContain("Learned this.")
  const after = await memoryReadTree(vault.path)
  const changed = after.filter((line) => !before.includes(line))
  expect(changed.map((line) => line.split(":")[0])).toEqual(
    expect.arrayContaining(["tools/Blank.md", "tools/index.md"]),
  )
  expect(await readFile(join(vault.path, "tools/Other.md"), "utf8")).toBe(noteWithId(2, "Other.", []))
  await expectRegistrationLeaseReleased(context)
})

test("a file with text keeps that text as the body", async () => {
  const { context, vault, blank } = await blankMemoryFixture("What the user typed in Obsidian")

  const result = await completeBlankMemory(
    { vault: "global", path: blank.path, expectedHash: blank.rawHash, type: "fact", body: "" },
    context,
  )

  expect(result.succeeded).toBe(true)
  expect(await readFile(join(vault.path, "tools/Blank.md"), "utf8")).toContain("What the user typed in Obsidian")
})

test("an empty file with no body is refused and stays empty", async () => {
  const { context, vault, blank } = await blankMemoryFixture("")

  const result = await completeBlankMemory(
    { vault: "global", path: blank.path, expectedHash: blank.rawHash, type: "fact", body: "" },
    context,
  )

  expect(result.succeeded).toBe(false)
  expect(await readFile(join(vault.path, "tools/Blank.md"), "utf8")).toBe("")
})

test("a file edited after the report is a conflict and keeps the edit", async () => {
  const { context, vault, blank } = await blankMemoryFixture("")
  await putCatalogFile(vault, "tools/Blank.md", "The user typed this meanwhile")

  const result = await completeBlankMemory(
    { vault: "global", path: blank.path, expectedHash: blank.rawHash, type: "fact", body: "Mine." },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(join(vault.path, "tools/Blank.md"), "utf8")).toBe("The user typed this meanwhile")
})

test("a note that already has frontmatter is not blank and is refused untouched", async () => {
  const { context, vault } = await blankMemoryFixture("")
  const note = noteWithId(2, "Other.", [])
  const expectedHash = createHash("sha256").update(note).digest("hex")

  const result = await completeBlankMemory(
    { vault: "global", path: "tools/Other.md", expectedHash, type: "fact", body: "x" },
    context,
  )

  expect(result).toMatchObject({ succeeded: false, reason: "not-blank" })
  expect(await readFile(join(vault.path, "tools/Other.md"), "utf8")).toBe(note)
})
