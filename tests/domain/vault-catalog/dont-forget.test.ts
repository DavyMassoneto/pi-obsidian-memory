import { expect, test } from "vitest"

import { isLoadedDontForget } from "#src/domain"
import { anInspectedFile, frontmatterLinesWith, noteText, validFrontmatterLines } from "#test-helpers"

const body = "Install packages with pnpm."

test("loads a marked note", () => {
  const text = noteText(frontmatterLinesWith("dontForget: true"), body)
  expect(isLoadedDontForget(anInspectedFile(text, false).analysis)).toBe(true)
})

test("does not load an unmarked note", () => {
  const text = noteText(validFrontmatterLines(), body)
  expect(isLoadedDontForget(anInspectedFile(text, false).analysis)).toBe(false)
})

test("does not load a marked note archived by path", () => {
  const text = noteText(frontmatterLinesWith("dontForget: true"), body)
  expect(isLoadedDontForget(anInspectedFile(text, true).analysis)).toBe(false)
})

test("does not load a marked note archived by field", () => {
  const lines = [...frontmatterLinesWith("dontForget: true"), "archived: 2026-10-05"]
  expect(isLoadedDontForget(anInspectedFile(noteText(lines, body), false).analysis)).toBe(false)
})

test("does not load a marked note whose frontmatter is invalid", () => {
  const text = noteText(["id: not-a-ulid", "dontForget: true", ...validFrontmatterLines().slice(1)], body)
  const analysis = anInspectedFile(text, false).analysis
  expect(analysis).toMatchObject({ status: "parsed", frontmatter: null })
  expect(isLoadedDontForget(analysis)).toBe(false)
})

test("does not load a marked note whose frontmatter is unclosed", () => {
  const analysis = anInspectedFile("---\nid: bad\ndontForget: true", false).analysis
  expect(analysis.status).toBe("unclosed")
  expect(isLoadedDontForget(analysis)).toBe(false)
})

test("loads a marked note with valid frontmatter despite name and body problems", () => {
  const text = noteText(frontmatterLinesWith("dontForget: true"), "")
  const analysis = anInspectedFile(text, false).analysis
  expect(analysis).toMatchObject({ needsFixing: true, bodyProblems: ["body: is empty"] })
  expect(isLoadedDontForget(analysis)).toBe(true)
})
