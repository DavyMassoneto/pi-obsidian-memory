import type { DontForgetVault, LoadDontForgetResult, LoadedDontForgetNote } from "#src/usecases"
import {
  BLOCK_FIELD_SEPARATOR,
  BLOCK_INTRO,
  BLOCK_NEEDS_FIXING_HEADING,
  BLOCK_SEPARATOR,
  DONT_FORGET_HEADING,
  LOAD_ERROR_PREFIX,
  LOAD_FAILURE_PREFIX,
  LOAD_FAILURE_SUFFIX,
  NO_DONT_FORGET,
  NOTE_HEADING_PREFIX,
} from "./constants.ts"

export function renderMemoryBlock(result: LoadDontForgetResult): string | null {
  if (!result.succeeded) {
    if (result.reason === "not-configured") return null
    return renderLoadFailure(result.problems.join("; "))
  }
  const notes = result.output.vaults.flatMap((vault) => vault.notes)
  const parts = [BLOCK_INTRO]
  if (notes.length === 0) parts.push(NO_DONT_FORGET)
  else parts.push(DONT_FORGET_HEADING, ...notes.map(renderNote))
  for (const vault of result.output.vaults) parts.push(...renderFailure(vault))
  return parts.join(BLOCK_SEPARATOR)
}

function renderNote(note: LoadedDontForgetNote): string {
  const heading = `${NOTE_HEADING_PREFIX}${[note.vault, note.path, note.type].join(BLOCK_FIELD_SEPARATOR)}`
  const lines = [heading, note.body]
  if (note.problems.length > 0)
    lines.push(BLOCK_NEEDS_FIXING_HEADING, ...note.problems.map((problem) => `- ${problem}`))
  return lines.join("\n")
}

function renderFailure(vault: DontForgetVault): string[] {
  return vault.problems.map((problem) => `${LOAD_FAILURE_PREFIX} ${vault.vault} ${LOAD_FAILURE_SUFFIX} ${problem}`)
}

export function loadNotices(result: LoadDontForgetResult): string[] {
  if (!result.succeeded) {
    if (result.reason === "not-configured") return []
    return [renderLoadNotice(result.problems.join("; "))]
  }
  return result.output.vaults.flatMap(renderFailure)
}

export function renderLoadNotice(message: string): string {
  return `${LOAD_ERROR_PREFIX} ${message}`
}

export function renderLoadFailure(message: string): string {
  return [BLOCK_INTRO, renderLoadNotice(message)].join(BLOCK_SEPARATOR)
}
