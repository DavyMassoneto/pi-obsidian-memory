import { SETUP_GUIDANCE } from "#src/pi/memory-add"
import type { SearchedMemory, SearchMemoryResult, VaultSearchFailure, VaultSearchHits } from "#src/usecases"
import {
  DONT_FORGET_MARK,
  NEEDS_FIXING_MARK,
  NO_PROJECT_VAULT,
  READ_HINT,
  SEARCH_FIELD_SEPARATOR,
} from "./constants.ts"
import type { MemorySearchResponse } from "./types.ts"

export function respondToSearch(result: SearchMemoryResult): MemorySearchResponse {
  if (result.succeeded) return describeSearched(result.output)
  switch (result.reason) {
    case "not-configured":
    case "invalid-config":
      return reply([...result.problems, SETUP_GUIDANCE], true)
    default:
      return reply(result.problems, true)
  }
}

function describeSearched(searched: SearchedMemory): MemorySearchResponse {
  const lines: string[] = []
  const failures = searched.vaults.filter(isFailure)
  const answered = searched.vaults.filter(isHits)
  for (const entry of answered) {
    for (const hit of entry.hits) lines.push(describeHit(entry.vault, hit))
  }
  if (answered.length > 0 && lines.length === 0) {
    const names = answered.map((entry) => entry.vault).join(", ")
    lines.push(`No notes found in ${names}. ${READ_HINT}`)
  }
  for (const entry of failures) {
    for (const problem of entry.problems) lines.push(`Could not search ${entry.vault}: ${problem}`)
  }
  for (const entry of answered) {
    for (const warning of entry.warnings) lines.push(`Warning: ${warning}`)
  }
  lines.push(...searched.semantic.problems)
  if (searched.projectMissing) lines.push(NO_PROJECT_VAULT)
  return reply(lines, answered.length === 0)
}

function describeHit(vault: string, hit: VaultSearchHits["hits"][number]): string {
  const fields = [vault, hit.path, hit.type]
  if (hit.dontForget) fields.push(DONT_FORGET_MARK)
  if (hit.needsFixing) fields.push(NEEDS_FIXING_MARK)
  return fields.join(SEARCH_FIELD_SEPARATOR)
}

function isFailure(entry: VaultSearchHits | VaultSearchFailure): entry is VaultSearchFailure {
  return "problems" in entry
}

function isHits(entry: VaultSearchHits | VaultSearchFailure): entry is VaultSearchHits {
  return "hits" in entry
}

function reply(lines: string[], isError: boolean): MemorySearchResponse {
  return { content: [{ type: "text", text: lines.join("\n") }], details: undefined, isError }
}
