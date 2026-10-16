import { Value } from "typebox/value"

import { checkEdges, checkFileSystemName, checkLinkCharacters } from "#src/domain/names"
import { FOLDER_INDEX_NAME } from "#src/domain/vault-path"
import { NOTE_CHARACTER_SEGMENTER } from "./constants.ts"
import { describeNoteSchemaErrors } from "./schema-errors.ts"
import { NoteFrontmatterSchema } from "./schemas.ts"
import type { Note, NoteFrontmatter, NoteLimits } from "./types.ts"

export function checkNote(note: Note, limits: NoteLimits): string[] {
  return [...checkFrontmatter(note.frontmatter), ...checkNoteText(note.statement, note.body, limits)]
}

export function checkNoteText(statement: string, body: string, limits: NoteLimits): string[] {
  return [...checkStatement(statement, limits.maxStatementChars), ...checkBody(body, limits.maxBodyChars)]
}

function checkFrontmatter(frontmatter: NoteFrontmatter): string[] {
  if (Value.Check(NoteFrontmatterSchema, frontmatter)) {
    return []
  }

  return describeNoteSchemaErrors(Value.Errors(NoteFrontmatterSchema, frontmatter), "frontmatter")
}

function checkStatement(statement: string, maxChars: number): string[] {
  if (statement.trim().length === 0) {
    return ["statement: is empty"]
  }

  return [
    ...checkLength("statement", statement, maxChars),
    ...checkFileSystemName("statement", statement),
    ...checkLinkCharacters("statement", statement),
    ...checkFolderIndexName(statement),
    ...checkEdges("statement", statement),
  ]
}

function checkBody(body: string, maxChars: number): string[] {
  if (body.trim().length === 0) {
    return ["body: is empty"]
  }

  return checkLength("body", body, maxChars)
}

function checkLength(label: string, text: string, maxChars: number): string[] {
  const length = countCharacters(text)
  if (length > maxChars) {
    return [`${label}: has ${length} characters, the limit is ${maxChars}`]
  }

  return []
}

function countCharacters(text: string): number {
  const graphemes = NOTE_CHARACTER_SEGMENTER.segment(text)
  return [...graphemes].length
}

function checkFolderIndexName(statement: string): string[] {
  if (statement.toLowerCase() === FOLDER_INDEX_NAME) {
    return [`statement: "${statement}" is reserved for folder indexes`]
  }

  return []
}
