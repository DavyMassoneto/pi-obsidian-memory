import { join } from "node:path"

import type { ChatModelPort, VaultContext } from "#src/services"
import {
  type DecisionProbe,
  type DiagnosedMemory,
  diagnoseMemory,
  type EmbeddingProbe,
  type MemoryOperationContext,
  resolveMemory,
} from "#src/usecases"
import { piMemoryFixture } from "./pi-memory.ts"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { useTempFolder } from "./temp-folder.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export interface FakeModel {
  provider: string
  id: string
}

export function chatModelPort(registered: FakeModel[], refusing: string[]): ChatModelPort<FakeModel> {
  return {
    find: (provider, id) => registered.find((model) => model.provider === provider && model.id === id),
    async auth(model) {
      if (refusing.includes(`${model.provider}/${model.id}`)) return { ok: false, error: "No API key" }
      return { ok: true }
    },
  }
}

export async function putBrokenVault(vault: VaultContext, maxNotesPerFolder: number): Promise<void> {
  await putCatalogFile(vault, "tools/Good.md", noteWithId(1, "Fine.", []))
  await putCatalogFile(vault, "tools/Broken.md", noteWithId(2, "Broken.", ["colour: red"]))
  await putCatalogFile(vault, "copies/Copy one.md", noteWithId(3, "Copy.", []))
  await putCatalogFile(vault, "copies/Copy two.md", noteWithId(3, "Copy.", []))
  await putCatalogFile(vault, "Blank.md", "")
  await putCatalogFile(vault, "tools/Half.md.tmp-abc", "partial")
  for (let number = 1; number <= maxNotesPerFolder + 1; number++) {
    await putCatalogFile(vault, `crowded/Note ${number}.md`, noteWithId(10 + number, `Crowded ${number}.`, []))
  }
}

export async function blankMemoryFixture(text: string) {
  const fixture = await searchFixture()
  await putCatalogFile(fixture.vault, "tools/Blank.md", text)
  await putCatalogFile(fixture.vault, "tools/Other.md", noteWithId(2, "Other.", []))
  const report = await diagnoseMemory(
    { port: chatModelPort([], []), embeddings: await emptyEmbeddingProbe(), decision: NO_DECISION_PROBE },
    fixture.context,
  )
  if (!report.succeeded) throw new Error("diagnosis failed")
  const global = report.output.vaults[0]
  if (!global || !("blanks" in global)) throw new Error("no blanks")
  const [blank] = global.blanks
  if (!blank) throw new Error("blank file not found")
  return { ...fixture, blank }
}

export async function brokenPiFixture() {
  const fixture = await piMemoryFixture()
  await putBrokenVault(fixture.vaults.global, fixture.config.limits.maxNotesPerFolder)
  return fixture
}

export async function blankPiFixture(text: string) {
  const fixture = await piMemoryFixture()
  await putCatalogFile(fixture.vaults.global, "tools/Blank.md", text)
  await putCatalogFile(fixture.vaults.global, "tools/Other.md", noteWithId(2, "Other.", []))
  return { ...fixture, blankFile: join(fixture.vaults.global.path, "tools/Blank.md") }
}

const CLEAN_DIAGNOSIS = { invalid: [], blank: [], duplicateIds: [], temporaries: [], crowdedFolders: [] }

export function diagnosedMemory(overrides: Partial<DiagnosedMemory>): DiagnosedMemory {
  return {
    vaults: [{ vault: "global", diagnosis: CLEAN_DIAGNOSIS, blanks: [], unreadable: [] }],
    projectMissing: false,
    maxNotesPerFolder: 20,
    embeddings: { provider: "local", model: "Xenova/multilingual-e5-small", status: "ready" },
    decision: { provider: "typesafe", model: "jev-latest", status: "ready", detail: "model and API key found" },
    cutoffs: { gate: { value: 0.5, source: "typesafe" }, relevance: { value: 0.5, source: "typesafe" } },
    models: [
      { role: "capture", check: { model: { provider: "p", id: "m" }, status: "ok" } },
      { role: "memory agent", check: { model: { provider: "p", id: "m" }, status: "ok" } },
    ],
    ...overrides,
  }
}

export async function resolvedMemoryOf(context: MemoryOperationContext) {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) throw new Error("memory did not resolve")
  return resolved.output
}

export async function resolvedFixture() {
  const fixture = await searchFixture()
  const memory = await resolvedMemoryOf(fixture.context)
  const projectTarget = memory.project
  if (!projectTarget) throw new Error("project did not resolve")
  return { ...fixture, memory, projectTarget }
}

export function embeddingProbe(modelCachePath: string, credentials: string[]): EmbeddingProbe {
  return { modelCachePath, hasCredentials: async (provider) => credentials.includes(provider) }
}

export async function emptyEmbeddingProbe(): Promise<EmbeddingProbe> {
  return embeddingProbe(join(await useTempFolder(), "models"), [])
}

export function decisionProbe(classifiers: string[], credentials: string[]): DecisionProbe {
  return {
    hasClassifier: (provider, model) => classifiers.includes(`${provider}/${model}`),
    hasCredentials: async (provider) => credentials.includes(provider),
  }
}

export const NO_DECISION_PROBE: DecisionProbe = decisionProbe([], [])
