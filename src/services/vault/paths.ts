import { NOTE_EXTENSION } from "./constants.ts"

export function noteFileName(statement: string): string {
  return `${statement}${NOTE_EXTENSION}`
}
