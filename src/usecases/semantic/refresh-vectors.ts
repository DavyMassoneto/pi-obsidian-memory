import {
  type EmbeddingBatchRequest,
  type EmbeddingInput,
  embeddingFingerprint,
  planVectorRefresh,
  readIndexInventory,
  readVectorCache,
  type SearchIndex,
  updateVectorCache,
  type VectorCache,
  type VectorChunk,
  type VectorGeneration,
  type VectorRefreshPlan,
} from "#src/services"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { ResolvedMemory } from "#src/usecases/resolve-memory"
import type { SemanticAvailable, SemanticPort } from "#src/usecases/semantic-port"
import { EMBED_BATCH_SIZE, EMBED_TIMEOUT_MS, OTHER_PROVIDER } from "./constants.ts"

export async function refreshSemantic(
  index: SearchIndex,
  memory: ResolvedMemory,
  port: SemanticPort | null,
  context: MemoryOperationContext,
): Promise<string[]> {
  if (!port) return []
  if (!port.available) return [`Semantic search is off: ${port.reason}`]
  return refreshVectors(index, memory, port, context)
}

async function refreshVectors(
  index: SearchIndex,
  memory: ResolvedMemory,
  port: SemanticAvailable,
  context: MemoryOperationContext,
): Promise<string[]> {
  const inventory = readIndexInventory(index)
  if (!inventory.succeeded) return inventory.problems
  const cache = readVectorCache(index)
  if (!cache.succeeded) return cache.problems
  const { revision } = inventory.output
  const fingerprint = embeddingFingerprint(memory.config.embeddings)
  const plan = planVectorRefresh(inventory.output.entries, cache.output, fingerprint)
  let stale = staleContent(cache.output, plan)
  const inputs = inputsOf(plan)
  if (inputs.length === 0) return removeStale(index, revision, cache.output.generation, fingerprint, stale)
  for (let start = 0; start < inputs.length; start += EMBED_BATCH_SIZE) {
    if (memoryOperationInterruption(context)) return []
    const batch: EmbeddingBatchRequest = { purpose: "document", inputs: inputs.slice(start, start + EMBED_BATCH_SIZE) }
    const embedded = await port.embed(batch, { signal: context.signal, timeoutMs: EMBED_TIMEOUT_MS })
    if (!embedded.succeeded) return [stoppedLine(embedded.status, start, inputs.length)]
    if (embedded.output.fingerprint !== fingerprint) return [OTHER_PROVIDER]
    const add: VectorChunk[] = embedded.output.items.map((item) => ({
      contentFingerprint: item.key,
      chunk: 0,
      vector: [...item.vector],
    }))
    const added = new Set(add.map((chunk) => chunk.contentFingerprint))
    const generation = { fingerprint, dimensions: embedded.output.dimensions }
    const remove = stale.filter((entry) => !added.has(entry))
    const written = updateVectorCache(index, { expectedRevision: revision, generation, add, remove })
    if (!written.succeeded) return written.problems
    stale = []
  }
  return []
}

function staleContent(cache: VectorCache, plan: VectorRefreshPlan): string[] {
  const kept = new Set(plan.keep.map((chunk) => chunk.contentFingerprint))
  return [...new Set(cache.chunks.map((chunk) => chunk.contentFingerprint))].filter((entry) => !kept.has(entry))
}

function inputsOf(plan: VectorRefreshPlan): EmbeddingInput[] {
  return plan.embed.flatMap((entry) => {
    if (!entry.note || !entry.contentFingerprint) return []
    return [{ key: entry.contentFingerprint, text: `${entry.note.statement}\n\n${entry.note.body}` }]
  })
}

function removeStale(
  index: SearchIndex,
  revision: number,
  generation: VectorGeneration | null,
  fingerprint: string,
  stale: string[],
): string[] {
  if (stale.length === 0 || !generation || generation.fingerprint !== fingerprint) return []
  const written = updateVectorCache(index, { expectedRevision: revision, generation, add: [], remove: stale })
  if (written.succeeded) return []
  return written.problems
}

function stoppedLine(status: string, done: number, total: number): string {
  return `Embedding stopped (${status}); ${done} of ${total} notes were embedded before it stopped`
}
