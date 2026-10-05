import {
  CHARACTERS_THAT_BREAK_OBSIDIAN_LINKS,
  CHARACTERS_WINDOWS_FORBIDS_IN_FILE_NAMES,
  FIRST_PRINTABLE_CHARACTER_CODE,
  WINDOWS_RESERVED_NAMES,
} from "./constants.ts"

export function checkFileSystemName(label: string, name: string): string[] {
  return [
    ...checkForbiddenCharacters(label, name),
    ...checkControlCharacters(label, name),
    ...checkReservedName(label, name),
  ]
}

export function checkLinkCharacters(label: string, name: string): string[] {
  const breakLinks = CHARACTERS_THAT_BREAK_OBSIDIAN_LINKS.filter((character) => name.includes(character))
  return breakLinks.map((character) => `${label}: "${character}" breaks Obsidian links`)
}

export function checkEdges(label: string, name: string): string[] {
  if (name !== name.trim()) {
    return [`${label}: starts or ends with a space`]
  }

  return checkTrailingDot(label, name)
}

export function checkTrailingEdge(label: string, name: string): string[] {
  if (name !== name.trimEnd()) {
    return [`${label}: ends with a space`]
  }

  return checkTrailingDot(label, name)
}

function checkTrailingDot(label: string, name: string): string[] {
  if (name.endsWith(".")) {
    return [`${label}: ends with a dot`]
  }

  return []
}

function checkForbiddenCharacters(label: string, name: string): string[] {
  const notAllowed = CHARACTERS_WINDOWS_FORBIDS_IN_FILE_NAMES.filter((character) => name.includes(character))
  return notAllowed.map((character) => `${label}: "${character}" is not allowed in a file name`)
}

function checkControlCharacters(label: string, name: string): string[] {
  const hasControlCharacter = [...name].some((character) => character.charCodeAt(0) < FIRST_PRINTABLE_CHARACTER_CODE)
  if (hasControlCharacter) {
    return [`${label}: has a control character`]
  }

  return []
}

function checkReservedName(label: string, name: string): string[] {
  const upperName = name.toUpperCase()
  const isReserved = WINDOWS_RESERVED_NAMES.some(
    (reserved) => upperName === reserved || upperName.startsWith(`${reserved}.`),
  )
  if (isReserved) {
    return [`${label}: "${name}" is reserved by Windows`]
  }

  return []
}
