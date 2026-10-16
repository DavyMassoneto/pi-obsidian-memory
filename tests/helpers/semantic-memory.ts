import { rename } from "node:fs/promises"
import { join } from "node:path"

import {
  type EmbeddingBatchRequest,
  type EmbeddingConfiguration,
  type EmbeddingFailureStatus,
  type EmbeddingResult,
  embeddingFingerprint,
  openIndex,
  readVectorCache,
  readVectorCoverage,
} from "#src/services"
import {
  type MemoryOperationContext,
  prepareSemanticSearch,
  type QueryVector,
  rankSemantically,
  type SemanticSource,
} from "#src/usecases"
import { resolvedMemoryOf } from "./diagnose-memory.ts"
import { noteWithId, searchFixture } from "./search-memory.ts"
import { synchronizedIndexPath } from "./synchronize-memory.ts"
import { putCatalogFile } from "./vault-catalog.ts"

const CONCEPTS = [
  ["car", "automobile", "vehicle", "engine"],
  ["dog", "puppy", "canine"],
  ["pnpm", "npm", "package"],
  ["deploy", "release", "ship"],
]

const BASE_DIMENSIONS = 5

function vectorOf(text: string, dimensions: number): number[] {
  const words = text.toLowerCase().split(/[^a-z]+/)
  const base = [...CONCEPTS.map((group) => words.filter((word) => group.includes(word)).length + 0.01), 0.01]
  return base.concat(Array<number>(dimensions).fill(0.01)).slice(0, dimensions)
}

export interface EmbedderFailure {
  batch: number
  status: EmbeddingFailureStatus
}

export type BatchHook = () => void

export interface FakeEmbedder {
  source: SemanticSource
  documents: string[][]
  queries: string[]
  failFrom: EmbedderFailure | null
  dimensions: Map<string, number>
  fingerprintOverride: string | null
  afterDocuments: BatchHook | null
}

export function fakeEmbedder(): FakeEmbedder {
  const fake: FakeEmbedder = {
    source: async () => ({ available: false, reason: "unset" }),
    documents: [],
    queries: [],
    failFrom: null,
    dimensions: new Map<string, number>(),
    fingerprintOverride: null,
    afterDocuments: null,
  }
  fake.source = async (configuration: EmbeddingConfiguration) => ({
    available: true,
    async embed(request: EmbeddingBatchRequest): Promise<EmbeddingResult> {
      if (request.purpose === "query") fake.queries.push(...request.inputs.map((input) => input.text))
      else fake.documents.push(request.inputs.map((input) => input.text))
      if (fake.failFrom && fake.documents.length >= fake.failFrom.batch && request.purpose === "document") {
        return { succeeded: false, status: fake.failFrom.status }
      }
      const configured = fake.dimensions.get(configuration.provider)
      let dimensions = BASE_DIMENSIONS
      if (typeof configured === "number") dimensions = configured
      const items = request.inputs.map((input) => ({ key: input.key, vector: vectorOf(input.text, dimensions) }))
      let fingerprint = embeddingFingerprint(configuration)
      if (fake.fingerprintOverride) fingerprint = fake.fingerprintOverride
      if (request.purpose === "document" && fake.afterDocuments) fake.afterDocuments()
      return { succeeded: true, output: { fingerprint, dimensions, items } }
    },
  })
  return fake
}

export async function semanticFixture() {
  const fixture = await searchFixture()
  const embedder = fakeEmbedder()
  const context = { ...fixture.context, semantic: embedder.source }
  return { ...fixture, embedder, context, plainContext: fixture.context }
}

export async function putConceptNotes(fixture: Awaited<ReturnType<typeof semanticFixture>>, count: number) {
  for (let number = 1; number <= count; number++) {
    await putCatalogFile(fixture.vault, `notes/Note ${number}.md`, noteWithId(number, `Plain words ${number}.`, []))
  }
}

export async function moveNote(vaultPath: string, from: string, to: string) {
  await rename(join(vaultPath, from), join(vaultPath, to))
}

export async function vectorState(context: MemoryOperationContext, vaultPath: string) {
  const opened = openIndex(await synchronizedIndexPath(context, vaultPath))
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    const coverage = readVectorCoverage(opened.output)
    const cache = readVectorCache(opened.output)
    if (!coverage.succeeded || !cache.succeeded) throw new Error("vectors unavailable")
    return { coverage: coverage.output, chunks: cache.output.chunks.length, generation: cache.output.generation }
  } finally {
    opened.output.close()
  }
}

export async function rankedFor(fixture: Awaited<ReturnType<typeof semanticFixture>>, text: string) {
  const memory = await resolvedMemoryOf(fixture.context)
  const port = await fixture.embedder.source(memory.config.embeddings)
  const prepared = await prepareSemanticSearch(port, text, fixture.context)
  if (!prepared.query) throw new Error("query was not embedded")
  const opened = openIndex(await synchronizedIndexPath(fixture.context, fixture.vault.path))
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    return rankSemantically(opened.output, prepared.query, memory.config.embeddings.provider)
  } finally {
    opened.output.close()
  }
}

export async function conceptVault() {
  const fixture = await semanticFixture()
  await putCatalogFile(fixture.vault, "vehicles/Car.md", noteWithId(1, "An engine on four wheels.", []))
  await putCatalogFile(fixture.vault, "pets/Dog.md", noteWithId(2, "A canine that barks.", []))
  return fixture
}

export async function rankedWithQuery(fixture: Awaited<ReturnType<typeof semanticFixture>>, query: QueryVector) {
  const memory = await resolvedMemoryOf(fixture.context)
  const opened = openIndex(await synchronizedIndexPath(fixture.context, fixture.vault.path))
  if (!opened.succeeded) throw new Error(opened.problems.join("; "))
  try {
    return rankSemantically(opened.output, query, memory.config.embeddings.provider)
  } finally {
    opened.output.close()
  }
}
