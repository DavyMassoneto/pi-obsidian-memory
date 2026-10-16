import { rm } from "node:fs/promises"
import { join } from "node:path"

import { vi } from "vitest"

import type { CompletionPort, CompletionRequest, MemoryConfig, RetrievalAction, RetrievalInput } from "#src/services"
import { LoadedMemory, type RetrieveDeps, type RetrieveMemoryResult } from "#src/usecases"
import { scriptedLaya } from "./laya-script.ts"
import { writeRegistrationSnapshot } from "./registration-usecases.ts"
import { noteWithId, searchFixture } from "./search-memory.ts"
import type { Done, LayaAsk, LayaScript, RetrievalStep } from "./types.ts"
import { putCatalogFile } from "./vault-catalog.ts"

const DATA_START = "<MEMORY_DATA>\n"
const DATA_END = "\n</MEMORY_DATA>"

export function retrievedInput(request: CompletionRequest): RetrievalInput {
  const start = request.data.indexOf(DATA_START) + DATA_START.length
  const end = request.data.lastIndexOf(DATA_END)
  return JSON.parse(request.data.slice(start, end))
}

export function retrievalCompletion(steps: RetrievalStep[]) {
  const remaining = [...steps]
  return vi.fn<CompletionPort>(async (request) => {
    const step = remaining.shift()
    if (!step) return { status: "completed", text: JSON.stringify({ action: "finish", notes: [] }) }
    if (typeof step === "function") return { status: "completed", text: JSON.stringify(step(retrievedInput(request))) }
    return { status: "completed", text: JSON.stringify(step) }
  })
}

export const FINISH_WITH_READS: RetrievalStep = (input) => ({
  action: "finish",
  notes: input.observations.flatMap((observation) => {
    if (observation.kind !== "read") return []
    return [{ vault: observation.vault, path: observation.path, id: observation.id, hash: observation.hash }]
  }),
})

export function getNote(path: string): RetrievalAction {
  return { action: "get", vault: "global", path }
}

export interface RelevantOptions {
  laya: LayaScript | null
  decisionModel?: MemoryConfig["decisionModel"]
  endpoint?: string
  budgetChars?: number
}

export function layaModel(endpoint: string): MemoryConfig["decisionModel"] {
  return { provider: "laya", endpoint, model: "multilingual", maxTokens: 8192, headMaxTokens: 192 }
}

export async function relevantFixture(options: RelevantOptions) {
  const base = await searchFixture()
  let decisionModel = base.config.decisionModel
  let asked: LayaAsk[] = []
  if (options.laya) {
    const laya = await scriptedLaya(options.laya)
    asked = laya.asked
    decisionModel = layaModel(laya.endpoint)
  }
  if (options.endpoint) decisionModel = layaModel(options.endpoint)
  if (options.decisionModel) decisionModel = options.decisionModel
  let budgetChars = base.config.context.budgetChars
  if (typeof options.budgetChars === "number") budgetChars = options.budgetChars
  const config = { ...base.config, decisionModel, context: { budgetChars } }
  await writeRegistrationSnapshot(base.context, JSON.stringify(config))
  const loaded = new LoadedMemory()
  const unavailable: RetrieveDeps["jev"] = async () => ({ available: false, reason: "no Jev in this test" })
  return { ...base, config, loaded, asked, unavailable }
}

export async function putNote(
  vault: Parameters<typeof putCatalogFile>[0],
  name: string,
  number: number,
  body: string,
): Promise<string> {
  const path = `tools/${name}.md`
  await putCatalogFile(vault, path, noteWithId(number, body, []))
  return path
}

export async function putDontForget(
  vault: Parameters<typeof putCatalogFile>[0],
  name: string,
  number: number,
  body: string,
): Promise<string> {
  const path = `tools/${name}.md`
  await putCatalogFile(vault, path, noteWithId(number, body, ["dontForget: true"]))
  return path
}

export function retrievedText(result: RetrieveMemoryResult): string {
  if (!result.succeeded) throw new Error(result.problems.join(", "))
  if (typeof result.output.text !== "string") throw new Error("no text was added")
  return result.output.text
}

export function firstRetrievalInput(complete: ReturnType<typeof retrievalCompletion>): RetrievalInput {
  const call = complete.mock.calls[0]
  if (!call) throw new Error("the memory agent was never asked")
  return retrievedInput(call[0])
}

export async function rmNote(vaultPath: string, path: string): Promise<void> {
  await rm(join(vaultPath, path))
}

export function slowCompletion(delayMs: number, steps: RetrievalAction[]) {
  const remaining = [...steps]
  return vi.fn<CompletionPort>(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs))
    const step = remaining.shift()
    if (!step) return { status: "completed", text: JSON.stringify({ action: "finish", notes: [] }) }
    return { status: "completed", text: JSON.stringify(step) }
  })
}

const REAL_SET_TIMEOUT = globalThis.setTimeout
const REAL_WAIT_MS = 5

export async function advanceUntil(isDone: Done, stepMs: number): Promise<void> {
  for (let step = 0; step < 400 && !isDone(); step++) {
    await vi.advanceTimersByTimeAsync(stepMs)
    await new Promise<void>((resolve) => REAL_SET_TIMEOUT(resolve, REAL_WAIT_MS))
  }
}
