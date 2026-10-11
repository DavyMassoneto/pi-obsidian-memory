import { NOTE_EXTENSION } from "./constants.ts"
import type { StoredFilePath } from "./types.ts"

export function storedFilePath(path: string): StoredFilePath {
  const separator = path.lastIndexOf("/")
  return { folder: path.slice(0, Math.max(0, separator)), fileName: path.slice(separator + 1) }
}

export function noteFileName(statement: string): string {
  return `${statement}${NOTE_EXTENSION}`
}
