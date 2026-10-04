import {
  CHARACTERS_THAT_BREAK_OBSIDIAN_LINKS,
  CHARACTERS_WINDOWS_FORBIDS_IN_FILE_NAMES,
  FIRST_PRINTABLE_CHARACTER_CODE,
  WINDOWS_RESERVED_NAMES,
} from "./constants.ts"
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
    ...checkForbiddenCharacters(statement),
    ...checkControlCharacters(statement),
    ...checkReservedName(statement),
    ...checkEdges(statement),
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

function checkForbiddenCharacters(statement: string): string[] {
  const notAllowed = CHARACTERS_WINDOWS_FORBIDS_IN_FILE_NAMES.filter((character) => statement.includes(character))
  const breakLinks = CHARACTERS_THAT_BREAK_OBSIDIAN_LINKS.filter((character) => statement.includes(character))

  return [
    ...notAllowed.map((character) => `statement: "${character}" is not allowed in a file name`),
    ...breakLinks.map((character) => `statement: "${character}" breaks Obsidian links`),
  ]
}

function checkControlCharacters(statement: string): string[] {
  const hasControlCharacter = [...statement].some(
    (character) => character.charCodeAt(0) < FIRST_PRINTABLE_CHARACTER_CODE,
  )
  if (hasControlCharacter) {
    return ["statement: has a control character"]
  }

  return []
}

function checkReservedName(statement: string): string[] {
  const name = statement.toUpperCase()
  const isReserved = WINDOWS_RESERVED_NAMES.some((reserved) => name === reserved || name.startsWith(`${reserved}.`))
  if (isReserved) {
    return [`statement: "${statement}" is reserved by Windows`]
  }

  return []
}

function checkEdges(statement: string): string[] {
  if (statement !== statement.trim()) {
    return ["statement: starts or ends with a space"]
  }

  if (statement.endsWith(".")) {
    return ["statement: ends with a dot"]
  }

  return []
}
