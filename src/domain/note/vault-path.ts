import {
  DRIVE_LETTER,
  HIDDEN_NAME_PREFIX,
  RELATIVE_NAMES,
  RESERVED_ROOT_FOLDERS,
  VAULT_PATH_SEPARATOR,
} from "./constants.ts"
import { checkEdges, checkFileSystemName, checkLinkCharacters, checkTrailingEdge } from "./names.ts"

export function joinVaultPath(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(VAULT_PATH_SEPARATOR)
}

export function ancestorFolders(folder: string): string[] {
  const parts = folder.split(VAULT_PATH_SEPARATOR).filter((part) => part.length > 0)
  const nested = parts.map((_part, depth) => parts.slice(0, parts.length - depth).join(VAULT_PATH_SEPARATOR))

  return [...nested, ""]
}

export function checkVaultPath(folder: string): string[] {
  if (folder.includes("\\")) {
    return ['folder: use "/" between folders']
  }

  if (folder.startsWith(VAULT_PATH_SEPARATOR) || DRIVE_LETTER.test(folder)) {
    return ["folder: must be relative to the vault"]
  }

  if (folder.length === 0) {
    return []
  }

  const problems = folder.split(VAULT_PATH_SEPARATOR).flatMap(checkFolderPart)
  return [...new Set(problems)]
}

export function checkMemoryFolder(folder: string): string[] {
  const problems = checkVaultPath(folder)
  if (problems.length > 0 || folder.length === 0) {
    return problems
  }

  return folder.split(VAULT_PATH_SEPARATOR).flatMap(checkMemoryFolderPart)
}

export function checkFileName(fileName: string): string[] {
  if (fileName.length === 0) {
    return ["file name: is empty"]
  }

  if (RELATIVE_NAMES.includes(fileName)) {
    return [`file name: "${fileName}" is not allowed`]
  }

  const label = `file name "${fileName}"`
  return [...checkFileSystemName(label, fileName), ...checkTrailingEdge(label, fileName)]
}

function checkFolderPart(part: string): string[] {
  if (part.length === 0) {
    return ["folder: has an empty part"]
  }

  if (RELATIVE_NAMES.includes(part)) {
    return [`folder: "${part}" is not allowed`]
  }

  const label = `folder "${part}"`
  return [...checkFileSystemName(label, part), ...checkLinkCharacters(label, part), ...checkEdges(label, part)]
}

function checkMemoryFolderPart(part: string, depth: number): string[] {
  const isReservedRoot = depth === 0 && RESERVED_ROOT_FOLDERS.includes(part.toLowerCase())
  if (isReservedRoot) {
    return [`folder "${part}": is reserved for the vault`]
  }

  if (part.startsWith(HIDDEN_NAME_PREFIX)) {
    return [`folder "${part}": is hidden (starts with ".")`]
  }

  return []
}
