import { joinVaultPath } from "#src/domain"
import { noteFileName } from "./paths.ts"

export function displayNotePath(folder: string, statement: string): string {
  return joinVaultPath(folder, noteFileName(statement))
}
