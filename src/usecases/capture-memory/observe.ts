import type { MemoryObservation, ReadObservation } from "#src/services"
import type { Failed } from "#src/shared"
import { BLANK_NOTE_TYPES } from "#src/usecases/complete-blank-memory"
import { getMemory } from "#src/usecases/get-memory"
import { listMemory } from "#src/usecases/list-memory"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { searchMemory } from "#src/usecases/search-memory"
import { DONT_FORGET_MARK, NO_DETAIL, NOTE_LINE, SOURCE_CALL, SUBFOLDER_LINE } from "./constants.ts"
import type { ExplicitSave, ListedNote, UnreadableNote } from "./types.ts"

export async function observeRead(
  save: ExplicitSave,
  context: MemoryOperationContext,
): Promise<ReadObservation | string> {
  const read = await observeLoadedNote(save, context)
  if (read.kind === "unreadable") return read.detail
  return read
}

export async function observeLoadedNote(
  save: ExplicitSave,
  context: MemoryOperationContext,
): Promise<ReadObservation | UnreadableNote> {
  const result = await getMemory({ vault: save.vault, path: save.path, sourceCallId: SOURCE_CALL }, context)
  if (!result.succeeded) {
    return { kind: "unreadable", existence: existenceAfterFailure(result), detail: detailOf(result.problems) }
  }
  if (result.output.kind !== "note") {
    return { kind: "unreadable", existence: "present", detail: `${save.path} is a folder, not a note` }
  }
  const { file } = result.output
  const { frontmatter, parsed } = file.analysis
  if (!frontmatter) {
    return {
      kind: "unreadable",
      existence: "present",
      detail: `${save.path} has invalid frontmatter and cannot be changed`,
    }
  }
  if (parsed.body.length === 0) return { kind: "unreadable", existence: "present", detail: `${save.path} has no body` }
  return {
    kind: "read",
    vault: save.vault,
    path: save.path,
    id: frontmatter.id,
    hash: file.rawHash,
    statement: parsed.statement,
    body: parsed.body,
    type: frontmatter.type,
    dontForget: "dontForget" in frontmatter,
  }
}

function existenceAfterFailure(failure: Failed): UnreadableNote["existence"] {
  if (!("reason" in failure)) return "unknown"
  if (failure.reason === "not-found" || failure.reason === "not-directory") return "gone"
  if (failure.reason === "unclosed-frontmatter") return "present"
  return "unknown"
}

export async function observeGet(save: ExplicitSave, context: MemoryOperationContext): Promise<MemoryObservation> {
  const read = await observeRead(save, context)
  if (typeof read === "string") return { kind: "unavailable", operation: "get", detail: read }
  return read
}

export async function observeSearch(
  vault: ExplicitSave["vault"],
  query: string,
  limit: number,
  context: MemoryOperationContext,
): Promise<MemoryObservation> {
  const result = await searchMemory({ query, vault }, context)
  if (!result.succeeded) return { kind: "unavailable", operation: "search", detail: detailOf(result.problems) }
  const found = result.output.vaults.find((entry) => entry.vault === vault)
  if (!found || !("hits" in found)) {
    return { kind: "unavailable", operation: "search", detail: "That vault is not available" }
  }
  const candidates = found.hits.slice(0, limit).map((hit) => ({
    vault,
    path: hit.path,
    id: hit.id,
    statement: hit.statement,
    snippet: hit.statement,
  }))
  return { kind: "search", query, candidates }
}

export async function observeList(
  vault: ExplicitSave["vault"],
  folder: string,
  context: MemoryOperationContext,
): Promise<MemoryObservation> {
  const result = await listMemory({ vault, folder }, context)
  if (!result.succeeded) return { kind: "unavailable", operation: "list", detail: detailOf(result.problems) }
  const lines = result.output.text.split("\n")
  const folders = lines.flatMap(subfolderOf)
  const notes = lines.flatMap((line) => noteOf(vault, line))
  return { kind: "listing", vault, folder, folders, notes }
}

function subfolderOf(line: string): string[] {
  const match = SUBFOLDER_LINE.exec(line)
  if (!match?.[1]) return []
  return [match[1]]
}

function noteOf(vault: ExplicitSave["vault"], line: string): ListedNote[] {
  const match = NOTE_LINE.exec(line)
  if (!match) return []
  const [, target, statement, name, rest] = match
  const type = BLANK_NOTE_TYPES.find((candidate) => candidate === name)
  if (!target || !statement || !type) return []
  const listed: ListedNote = { vault, path: `${target}.md`, type, statement }
  if (typeof rest === "string" && rest.toLowerCase().includes(DONT_FORGET_MARK)) listed.dontForget = true
  return [listed]
}

export function detailOf(problems: string[]): string {
  const joined = problems.join("; ")
  if (joined === "") return NO_DETAIL
  return joined
}
