import { expect, test } from "vitest"

import { archiveNote, type Note, type NoteType, succeedNote } from "#/domain"
import { aNote } from "#test-helpers"

const today = "2026-10-06"

function noteAbout(statement: string, type: NoteType): Note {
  const note = aNote()
  return { ...note, statement, frontmatter: { ...note.frontmatter, type } }
}

const question = { folder: "search", note: noteAbout("Local or remote embeddings", "question") }
const decision = { folder: "search", note: noteAbout("Chose local embeddings", "decision") }

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
