import { mkdir, readFile } from "node:fs/promises"

import { settingLines } from "#src/pi"
import type { MemoryConfig } from "#src/services"
import { fakePiContext, type PromptScript } from "./pi-context.ts"
import { piMemoryFixture } from "./pi-memory.ts"
import { registrationUsecaseFixture, writeRegistrationSnapshot } from "./registration-usecases.ts"
import { SETUP_MODEL } from "./setup-context.ts"

export const CHEAP_MODEL = { provider: "cheap-co", id: "haiku", cost: { input: 1, output: 5 } }

export const CHEAP_LABEL = "cheap-co/haiku · $1 in / $5 out per 1M tokens"

export const SCREEN = {
  captureModel: "Capture model: test-chat/selected-chat",
  captureWhen: "Capture runs: after each turn",
  agentModel: "Memory agent model: test-chat/selected-chat",
  decision: "Decision model: Laya (http://127.0.0.1:8000/v1/systemone)",
  gate: "Gate cutoff: not set",
  relevance: "Relevance cutoff: not set",
  embeddings: "Embeddings: local (Xenova/multilingual-e5-small)",
  budget: "Context budget: 12000 characters",
  maxBody: "Max note body: 1000 characters",
  maxStatement: "Max statement: 100 characters",
  maxNotes: "Max notes per folder: 20",
  projects: "Projects: 1",
  done: "Done",
}

export async function settingsFixture() {
  return piMemoryFixture()
}

export function screenContext(cwd: string, selects: (string | undefined)[], answers: Partial<PromptScript>) {
  return fakePiContext(cwd, {
    available: [SETUP_MODEL, CHEAP_MODEL],
    answers: { ...answers, selects },
  })
}

export async function savedConfig(configPath: string) {
  return JSON.parse(await readFile(configPath, "utf8"))
}

export function projectLine(vault: string, folder: string): string {
  return `loja — ${folder} → ${vault}`
}

export function lineLabels(config: MemoryConfig): string[] {
  return settingLines(config).map((line) => line.label)
}

export async function settingsEnv() {
  const fixture = await registrationUsecaseFixture()
  await mkdir(fixture.config.global.vault)
  const hash = await writeRegistrationSnapshot(fixture.context, JSON.stringify(fixture.config))
  const { context: ctx, notifications } = fakePiContext(fixture.context.workingFolder, {})
  const env = {
    ctx,
    context: fixture.context,
    state: { config: fixture.config, hash },
    deps: { registration: fixture.context, changeGlobalVault: async () => undefined },
  }
  return { env, notifications }
}

export async function configuredSettings() {
  const fixture = await registrationUsecaseFixture()
  await mkdir(fixture.config.global.vault)
  const hash = await writeRegistrationSnapshot(fixture.context, JSON.stringify(fixture.config))
  return { ...fixture, hash }
}

export async function writtenConfig(path: string) {
  return JSON.parse(await readFile(path, "utf8"))
}
