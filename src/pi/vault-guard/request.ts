import { join } from "node:path"

import { isToolCallEventType, type ToolCallEvent } from "@earendil-works/pi-coding-agent"

import type { GuardRequest } from "#src/usecases"
import { GLOB_METACHARACTERS } from "./constants.ts"

export function accessRequestsOf(event: ToolCallEvent, cwd: string): GuardRequest[] {
  if (isToolCallEventType("read", event)) return [{ kind: "file", path: event.input.path }]
  if (isToolCallEventType("write", event)) return writeRequests(event.input.path)
  if (isToolCallEventType("edit", event)) return writeRequests(event.input.path)
  if (isToolCallEventType("grep", event)) return searchRequests(event.input.path, event.input.glob, cwd)
  if (isToolCallEventType("find", event)) return searchRequests(event.input.path, event.input.pattern, cwd)
  if (isToolCallEventType("ls", event)) return [{ kind: "listing", path: pathOrFolder(event.input.path, cwd) }]
  if (isToolCallEventType("bash", event)) return [{ kind: "command", command: event.input.command }]
  if (isToolCallEventType("powershell", event)) return [{ kind: "command", command: event.input.command }]
  return []
}

function writeRequests(path: string): GuardRequest[] {
  return [
    { kind: "file", path },
    { kind: "config-write", path },
  ]
}

function searchRequests(path: string | undefined, glob: string | undefined, cwd: string): GuardRequest[] {
  const root = pathOrFolder(path, cwd)
  const requests: GuardRequest[] = [{ kind: "tree", path: root }]
  if (typeof glob !== "string") return requests
  const prefix = literalPrefix(glob)
  if (prefix === "") return requests
  requests.push({ kind: "tree", path: prefix }, { kind: "tree", path: join(root, prefix) })
  return requests
}

function literalPrefix(glob: string): string {
  const first = glob.search(GLOB_METACHARACTERS)
  if (first === -1) return glob
  return glob.slice(0, first)
}

function pathOrFolder(path: string | undefined, cwd: string): string {
  if (typeof path === "string") return path
  return cwd
}
