import type { MemoryConfig } from "#src/services"
import { LoadedMemory } from "#src/usecases"
import { writeRegistrationSnapshot } from "./registration-usecases.ts"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export function layaModel(endpoint: string): MemoryConfig["decisionModel"] {
  return {
    provider: "laya",
    endpoint,
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
    gateThreshold: 0.2,
    relevanceThreshold: 0.5,
  }
}

export async function relevantFixture() {
  const base = await searchFixture()
  await writeRegistrationSnapshot(base.context, JSON.stringify(base.config))
  const loaded = new LoadedMemory()
  return { ...base, loaded }
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
