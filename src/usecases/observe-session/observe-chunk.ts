import { type CompletionPort, localTimestamp, nowMs, observerChunkText, observeStep } from "#src/services"
import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import type { ObserveChunkRequest, ObserveChunkResult } from "./types.ts"

export async function observeChunk(
  request: ObserveChunkRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<ObserveChunkResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { observer } = resolved.output.config
  return observeStep(
    {
      signal: context.signal,
      model: observer.model,
      thinking: observer.thinking,
      chunk: observerChunkText(request.records, request.range, observer.chunkTokens),
      now: localTimestamp(nowMs()),
    },
    complete,
  )
}
