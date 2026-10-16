import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { vi } from "vitest"

import type { CaptureAction, CaptureInput, CompletionPort, CompletionRequest } from "#src/services"
import type { CaptureRun, ClarifyPort } from "#src/usecases"
import { changeFixture } from "./memory-change.ts"
import { registerFakePiAt } from "./pi.ts"
import { piMemoryFixture } from "./pi-memory.ts"
import { writeAgentConfig } from "./pi-registration.ts"
import type { Check, ScriptStep } from "./types.ts"

const DATA_START = "<MEMORY_DATA>\n"
const DATA_END = "\n</MEMORY_DATA>"

export function capturedInput(request: CompletionRequest): CaptureInput {
  const start = request.data.indexOf(DATA_START) + DATA_START.length
  const end = request.data.lastIndexOf(DATA_END)
  return JSON.parse(request.data.slice(start, end))
}

export function scriptedCompletion(steps: ScriptStep[]) {
  const remaining = [...steps]
  return vi.fn<CompletionPort>(async (request) => {
    const step = remaining.shift()
    if (!step) return { status: "completed", text: JSON.stringify({ action: "finish" }) }
    if (typeof step === "function")
      return { status: "completed", text: JSON.stringify(await step(capturedInput(request))) }
    return { status: "completed", text: JSON.stringify(step) }
  })
}

export function answering(answer: string | null) {
  return vi.fn<ClarifyPort>(async () => answer)
}

export function userSays(text: string) {
  return [{ role: "user" as const, text }]
}

export async function captureFixture() {
  return changeFixture()
}

export async function capturePiFixture(
  when: "after-each-turn" | "on-compaction" | "at-session-end",
  steps: ScriptStep[],
) {
  const fixture = await piMemoryFixture()
  const capture = { ...fixture.config.capture, when }
  await writeAgentConfig(fixture.configPath, JSON.stringify({ ...fixture.config, capture }))
  const complete = scriptedCompletion(steps)
  const pi = registerFakePiAt(fixture.agentDir, {}, { completionOf: () => complete })
  return { ...fixture, pi, complete }
}

export const PNPM_ADD: CaptureAction = {
  action: "add",
  vault: "global",
  note: {
    folder: "preferences",
    statement: "Use pnpm",
    body: "The user always uses pnpm.",
    type: "rule",
    dontForget: false,
  },
}

export const ADD_PNPM: ScriptStep[] = [PNPM_ADD, { action: "finish" }]

export async function noteWritten(globalVault: string): Promise<string[]> {
  const names = await readdir(join(globalVault, "preferences")).catch(() => [])
  return names.filter((name) => name !== "index.md")
}

export function reviewRun(text: string): CaptureRun {
  return { trigger: "after-each-turn", messages: userSays(text), explicitSaves: [] }
}

const EVENTUALLY_MS = 8000

export async function eventually(check: Check): Promise<void> {
  await vi.waitFor(check, { timeout: EVENTUALLY_MS, interval: 20 })
}
