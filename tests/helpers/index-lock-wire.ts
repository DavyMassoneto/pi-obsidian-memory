import type { Serializable } from "node:child_process"

export type ChildRole = "holder" | "operator" | "recoverer"

export type IndexOperation =
  | "put"
  | "replaceVectors"
  | "recordFolderIndexes"
  | "open"
  | "search"
  | "searchCatalog"
  | "inventory"
  | "vectors"
  | "vectorCoverage"
  | "folderIndexes"

export type ReportType = "held" | "opened" | "ready" | "done" | "recovered" | "written" | "failed"

export type CommandType = "call" | "release" | "write"

export interface ChildReport {
  type: ReportType
  outcome: string
}

export interface ChildCommand {
  type: CommandType
}

const REPORT_TYPES: readonly ReportType[] = ["held", "opened", "ready", "done", "recovered", "written", "failed"]
const COMMAND_TYPES: readonly CommandType[] = ["call", "release", "write"]
const OPERATIONS: readonly IndexOperation[] = [
  "put",
  "replaceVectors",
  "recordFolderIndexes",
  "open",
  "search",
  "searchCatalog",
  "inventory",
  "vectors",
  "vectorCoverage",
  "folderIndexes",
]

export function reportOf(message: Serializable): ChildReport | null {
  if (typeof message !== "object" || !("type" in message) || !("outcome" in message)) return null
  const type = REPORT_TYPES.find((candidate) => candidate === message.type)
  if (!type || typeof message.outcome !== "string") return null
  return { type, outcome: message.outcome }
}

export function commandNamed(message: Serializable): CommandType | null {
  if (typeof message !== "object" || !("type" in message)) return null
  const command = COMMAND_TYPES.find((candidate) => candidate === message.type)
  if (!command) return null
  return command
}

export function operationNamed(name: string): IndexOperation {
  const operation = OPERATIONS.find((candidate) => candidate === name)
  if (!operation) throw new Error(`unknown operation ${name}`)
  return operation
}
