import { Value } from "typebox/value"

import { checkVaultPath } from "#/domain/vault-path"
import { RetrievalActionSchema } from "./schemas.ts"
import type {
  AgentContext,
  MemoryIdentity,
  MemoryObservation,
  ReadAction,
  RetrievalInput,
  RetrievalResult,
} from "./types.ts"

export function parseRetrievalAction(text: string, input: RetrievalInput): RetrievalResult {
  try {
    const action = JSON.parse(text)
    if (!Value.Check(RetrievalActionSchema, action)) {
      return { succeeded: false, problems: ["Invalid retrieval action"] }
    }
    if (action.action === "finish") {
      if (!action.notes.every((note) => canSelectNote(note, input))) {
        return { succeeded: false, problems: ["Selected notes require matching reads in an available vault"] }
      }
      return { succeeded: true, output: action }
    }
    const problems = checkReadAction(action, input.context)
    if (problems.length > 0) return { succeeded: false, problems }
    return { succeeded: true, output: action }
  } catch {
    return { succeeded: false, problems: ["Invalid retrieval JSON"] }
  }
}

export function checkReadAction(action: ReadAction, context: AgentContext): string[] {
  const problems = checkAgentVault(action.vault, context)
  if (action.action === "get") {
    problems.push(...checkVaultPath(action.path))
    if (!action.path.endsWith(".md")) problems.push("get requires a note path ending in .md")
  }
  if (action.action === "list") problems.push(...checkVaultPath(action.folder))
  if (action.action === "search" && action.query.trim().length === 0) problems.push("Search query is empty")
  return problems
}

export function checkAgentVault(vault: "global" | "project", context: AgentContext): string[] {
  if (vault === "project" && !context.project) return ["Project vault is unavailable"]
  return []
}

export function hasReadIdentity(identity: MemoryIdentity, observations: readonly MemoryObservation[]): boolean {
  const latest = observations.findLast(
    (read) =>
      read.kind === "read" && read.vault === identity.vault && (read.path === identity.path || read.id === identity.id),
  )
  if (latest?.kind !== "read") return false
  return latest.path === identity.path && latest.id === identity.id && latest.hash === identity.hash
}

function canSelectNote(identity: MemoryIdentity, input: RetrievalInput): boolean {
  return (
    checkAgentVault(identity.vault, input.context).length === 0 &&
    checkVaultPath(identity.path).length === 0 &&
    hasReadIdentity(identity, input.observations)
  )
}
