import { detailOf, observeRead } from "#src/usecases/capture-memory"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import { searchMemory } from "#src/usecases/search-memory"
import type { LoadedStore, RankedNotes } from "./types.ts"

export async function searchRelevantNotes(
  message: string,
  context: MemoryOperationContext,
  loaded: LoadedStore,
): Promise<RankedNotes> {
  const result = await searchMemory({ query: message, vault: "both" }, context)
  if (!result.succeeded) {
    if (memoryOperationInterruption(context)) return { notes: [], notice: null }
    return { notes: [], notice: `Could not search memory: ${detailOf(result.problems)}` }
  }
  const hits = result.output.vaults.flatMap((entry) => {
    if (!("hits" in entry)) return []
    return entry.hits.map((hit) => ({ vault: entry.vault, path: hit.path }))
  })
  const reads = await Promise.all(hits.map((hit) => observeRead(hit, context)))
  const notes = reads.flatMap((read) => {
    if (typeof read === "string" || read.dontForget || loaded.has(read)) return []
    return [read]
  })
  return { notes, notice: null }
}
