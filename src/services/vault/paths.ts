import { joinVaultPath } from "#/domain"
import { NOTE_EXTENSION } from "./constants.ts"

export function noteFileName(statement: string): string {
  return `${statement}${NOTE_EXTENSION}`
}

export function displayPath(folder: string, fileName: string): string {
  return joinVaultPath(folder, fileName)
}

export function displayNotePath(folder: string, statement: string): string {
  return displayPath(folder, noteFileName(statement))
}
