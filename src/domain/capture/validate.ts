import { Value } from "typebox/value"

import { checkAgentVault, checkReadAction, hasReadIdentity, type MemoryIdentity } from "#/domain/memory-agent"
import { checkNoteText } from "#/domain/note"
import { checkMemoryFolder, checkVaultPath, joinVaultPath } from "#/domain/vault-path"
import { CaptureActionSchema } from "./schemas.ts"
import type { CaptureAction, CaptureAdd, CaptureDraft, CaptureInput, CaptureResult } from "./types.ts"

export function parseCaptureAction(text: string, input: CaptureInput): CaptureResult {
  try {
    const action = JSON.parse(text)
    if (!Value.Check(CaptureActionSchema, action)) {
      return { succeeded: false, problems: ["Invalid capture action"] }
    }
    const problems = checkCaptureAction(action, input)
    if (problems.length > 0) return { succeeded: false, problems }
    return { succeeded: true, output: action }
  } catch {
    return { succeeded: false, problems: ["Invalid capture JSON"] }
  }
}

function checkCaptureAction(action: CaptureAction, input: CaptureInput): string[] {
  if (action.action === "finish") return []
  if (action.action === "clarify") {
    if (action.question.trim().length === 0) return ["Clarification question is empty"]
    return []
  }
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
  const reads = input.observations.filter((item) => item.kind !== "write")
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
