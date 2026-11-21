import { Value } from "typebox/value"

import { checkAgentVault, checkReadAction, hasReadIdentity, type MemoryIdentity } from "#src/domain/memory-agent"
import { checkNoteText } from "#src/domain/note"
import { checkMemoryFolder, checkVaultPath, joinVaultPath } from "#src/domain/vault-path"
import { SCOPE_REASON_REQUIRED } from "./constants.ts"
import { CaptureActionSchema, ProposalShapeSchema } from "./schemas.ts"
import type { CaptureAction, CaptureAdd, CaptureDraft, CaptureInput, CaptureResult, ProposedAction } from "./types.ts"

export function parseCaptureAction(text: string, input: CaptureInput): CaptureResult {
  try {
    const action = JSON.parse(text)
    const proposed = summarize(action)
    const missing = missingScopeReason(proposed)
    if (missing.length > 0) return { succeeded: false, problems: missing, proposed }
    if (!Value.Check(CaptureActionSchema, action)) {
      return { succeeded: false, problems: ["Invalid capture action"], proposed }
    }
    const problems = checkCaptureAction(action, input)
    if (problems.length > 0) return { succeeded: false, problems, proposed }
    return { succeeded: true, output: action }
  } catch {
    return { succeeded: false, problems: ["Invalid capture JSON"] }
  }
}

function missingScopeReason(proposed: ProposedAction | undefined): string[] {
  if (!proposed) return []
  const { action, scopeReason } = proposed
  if (action !== "add" && action !== "update" && action !== "succeed") return []
  if (scopeReason && scopeReason.trim() !== "") return []
  return [SCOPE_REASON_REQUIRED]
}

function summarize(parsed: ReturnType<typeof JSON.parse>): ProposedAction | undefined {
  if (!Value.Check(ProposalShapeSchema, parsed)) return undefined
  const action = parsed
  const proposed: ProposedAction = { action: action.action }
  if (action.vault) proposed.vault = action.vault
  if (action.path) proposed.title = action.path
  else if (action.note?.statement) proposed.title = action.note.statement
  if (action.scopeReason) proposed.scopeReason = action.scopeReason
  return proposed
}

function checkCaptureAction(action: CaptureAction, input: CaptureInput): string[] {
  if (action.action === "finish") return []
  if (action.action === "search" || action.action === "get" || action.action === "list") {
    return checkReadAction(action, input.context)
  }
  const problems = checkAgentVault(action.vault, input.context)
  if (action.action !== "add") {
    const identity = { vault: action.vault, path: action.path, id: action.id, hash: action.expectedHash }
    problems.push(...checkMutation(identity, input))
  }
  if (action.action !== "archive") problems.push(...checkDraft(action.note, input))
  if (action.action === "add") problems.push(...checkDuplicate(action, input))
  if ((action.action === "add" || action.action === "succeed") && action.note.folder.length === 0) {
    problems.push("New capture notes require a subject folder")
  }
  if (
    action.action === "update" &&
    (action.path.slice(-3).toLowerCase() !== ".md" ||
      action.path.slice(0, -3) !== joinVaultPath(action.note.folder, action.note.statement))
  ) {
    problems.push("Update must keep the read note's folder and statement")
  }
  return problems
}

function checkMutation(identity: MemoryIdentity, input: CaptureInput): string[] {
  const latest = input.observations.findLast(
    (item) =>
      (item.kind === "read" || item.kind === "write") && item.vault === identity.vault && item.path === identity.path,
  )
  const reads = input.observations.filter((item) => item.kind !== "write" && item.kind !== "refused")
  if (latest?.kind !== "read" || !hasReadIdentity(identity, reads)) {
    return ["Mutation requires a fresh matching read identity and hash"]
  }
  return checkVaultPath(identity.path)
}

function checkDraft(note: CaptureDraft, input: CaptureInput): string[] {
  return [...checkNoteText(note.statement, note.body, input.limits), ...checkMemoryFolder(note.folder)]
}

function checkDuplicate(action: CaptureAdd, input: CaptureInput): string[] {
  const existing = [...input.explicitSaves, ...input.observations.filter((item) => item.kind === "read")]
  const path = joinVaultPath(action.note.folder, `${action.note.statement}.md`).toLowerCase()
  const duplicate = existing.some(
    (read) =>
      read.vault === action.vault &&
      (read.path.toLowerCase() === path ||
        (read.statement === action.note.statement && read.body === action.note.body)),
  )
  if (duplicate) return ["Existing point requires an update or finish, not a duplicate add"]
  return []
}
