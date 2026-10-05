import { FOLDER_INDEX_NAME } from "./constants.ts"
import { checkEdges, checkFileSystemName, checkLinkCharacters } from "./names.ts"
import type { Note, NoteLimits } from "./types.ts"

export function checkNote(note: Note, limits: NoteLimits): string[] {
  return [...checkStatement(note.statement, limits.maxStatementChars), ...checkBody(note.body, limits.maxBodyChars)]
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
  const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)
  return [...graphemes].length
}

function checkFolderIndexName(statement: string): string[] {
  if (statement.toLowerCase() === FOLDER_INDEX_NAME) {
    return [`statement: "${statement}" is reserved for folder indexes`]
  }

  return []
}
