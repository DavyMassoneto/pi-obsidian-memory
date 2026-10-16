import { expect, test } from "vitest"

import { archiveNote, type NoteType, succeedNote, updatedNote } from "#src/domain"
import { aDecision, aDontForgetNote, aNote, aQuestion, noteAbout } from "#test-helpers"

const today = "2026-10-06"
const updatedOn = "2026-11-02"

const question = { folder: "search", note: aQuestion() }
const decision = { folder: "search", note: aDecision() }

test("archives a note under archive/, keeping its subject path and everything but the archived date", () => {
  const archived = archiveNote(question, today)

  expect(archived).toEqual({
    folder: "archive/search",
    note: { ...question.note, frontmatter: { ...question.note.frontmatter, archived: today } },
  })
})

test("archives a note from the vault root directly under archive/", () => {
  expect(archiveNote({ ...question, folder: "" }, today).folder).toBe("archive")
})

test("archives the previous note and links both notes to each other", () => {
  const { archived, successor } = succeedNote(question, decision, today)

  expect(archived.folder).toBe("archive/search")
  expect(archived.note.frontmatter).toMatchObject({ archived: today, replacedBy: "[[search/Chose local embeddings]]" })
  expect(successor.folder).toBe("search")
  expect(successor.note.frontmatter.replaces).toBe("[[archive/search/Local or remote embeddings]]")
})

test("makes the successor born today", () => {
  const { successor } = succeedNote(question, decision, today)

  expect(successor.note.frontmatter).toMatchObject({ created: today, updated: today })
})

test("links a successor that lives in another folder", () => {
  const { archived } = succeedNote(question, { ...decision, folder: "search/embeddings" }, today)

  expect(archived.note.frontmatter.replacedBy).toBe("[[search/embeddings/Chose local embeddings]]")
})

test.each<[NoteType, NoteType]>([
  ["question", "decision"],
  ["question", "issue"],
  ["risk", "lesson"],
  ["idea", "question"],
  ["fact", "fact"],
])("lets a %s be succeeded by a %s", (from, to) => {
  const { archived, successor } = succeedNote(
    { folder: "x", note: noteAbout("Before", from) },
    { folder: "x", note: noteAbout("After", to) },
    today,
  )

  expect(archived.note.frontmatter.type).toBe(from)
  expect(successor.note.frontmatter.type).toBe(to)
})

test("update keeps id, created and statement, sets updated and changes body, type and dontForget", () => {
  const note = aNote()
  const result = updatedNote(note, { body: "New body.", type: "decision", dontForget: true }, updatedOn)

  expect(result).toEqual({
    statement: note.statement,
    frontmatter: { ...note.frontmatter, type: "decision", updated: updatedOn, dontForget: true },
    body: "New body.",
  })
})

test("update removes dontForget when the change turns it off", () => {
  const note = aDontForgetNote("Use pnpm")
  const result = updatedNote(note, { body: "Body.", type: "rule", dontForget: false }, updatedOn)

  expect(result.frontmatter).not.toHaveProperty("dontForget")
})

test("update keeps replaces, replacedBy and archived", () => {
  const note = aNote()
  const links = { replaces: "[[archive/a/Old]]", replacedBy: "[[a/New]]", archived: "2026-10-05" } as const
  const result = updatedNote(
    { ...note, frontmatter: { ...note.frontmatter, ...links } },
    { body: "Body.", type: "rule", dontForget: false },
    updatedOn,
  )

  expect(result.frontmatter).toMatchObject(links)
})

test("update does not change the note it was given", () => {
  const note = aDontForgetNote("Use pnpm")
  const snapshot = structuredClone(note)
  updatedNote(note, { body: "Other.", type: "fact", dontForget: false }, updatedOn)

  expect(note).toEqual(snapshot)
})
