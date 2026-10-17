import type { MemoryOperationContext } from "#src/usecases/operation-context"
import type { ResolvedMemory } from "#src/usecases/resolve-memory"
import type { SemanticPort } from "#src/usecases/semantic-port"
import { QUERY_KEY, QUERY_NOT_EMBEDDED } from "./constants.ts"
import type { SemanticSearch } from "./types.ts"

export async function semanticPortOf(
  context: MemoryOperationContext,
  memory: ResolvedMemory,
): Promise<SemanticPort | null> {
  if (!context.semantic) return null
  return context.semantic(memory.config.embeddings)
}

export async function prepareSemanticSearch(
  port: SemanticPort | null,
  text: string,
  context: MemoryOperationContext,
): Promise<SemanticSearch> {
  if (!port) return { query: null, problems: [] }
  if (!port.available) return { query: null, problems: [`Semantic search is off: ${port.reason}`] }
  const embedded = await port.embed(
    { purpose: "query", inputs: [{ key: QUERY_KEY, text }] },
    { signal: context.signal },
  )
  if (!embedded.succeeded) return { query: null, problems: [QUERY_NOT_EMBEDDED] }
  const [item] = embedded.output.items
  if (!item) return { query: null, problems: [QUERY_NOT_EMBEDDED] }
  return { query: { fingerprint: embedded.output.fingerprint, vector: [...item.vector] }, problems: [] }
}
