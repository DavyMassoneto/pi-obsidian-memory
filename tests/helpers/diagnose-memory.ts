import type { VaultContext } from "#src/services"
import { type DiagnosedMemory, type MemoryOperationContext, resolveMemory } from "#src/usecases"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

export async function putBrokenVault(vault: VaultContext): Promise<void> {
  await putCatalogFile(vault, "tools/Good.md", noteWithId(1, "Fine.", []))
  await putCatalogFile(vault, "tools/Broken.md", noteWithId(2, "Broken.", ["colour: red"]))
  await putCatalogFile(vault, "copies/Copy one.md", noteWithId(3, "Copy.", []))
  await putCatalogFile(vault, "copies/Copy two.md", noteWithId(3, "Copy.", []))
  await putCatalogFile(vault, "Blank.md", "")
  await putCatalogFile(vault, "tools/Half.md.tmp-abc", "partial")
}

const CLEAN_DIAGNOSIS = { invalid: [], blank: [], duplicateIds: [], temporaries: [] }

export function diagnosedMemory(overrides: Partial<DiagnosedMemory>): DiagnosedMemory {
  return {
    vaults: [{ vault: "global", diagnosis: CLEAN_DIAGNOSIS, blanks: [], unreadable: [] }],
    projectMissing: false,
    omLoaded: false,
    embeddings: { provider: "local", model: "Xenova/multilingual-e5-small", status: "ready" },
    decision: { provider: "typesafe", model: "jev-latest", status: "ready", detail: "model and API key found" },
    cutoffs: { gate: { value: 0.5, source: "typesafe" }, relevance: { value: 0.5, source: "typesafe" } },
    models: [
      { role: "observer", check: { model: { provider: "p", id: "m" }, status: "ok" } },
      { role: "consolidator", check: { model: { provider: "p", id: "m" }, status: "ok" } },
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
