import { invalidatedBlock, type ReadObservation, replacementBlock } from "#src/services"
import { observeRead } from "#src/usecases/capture-memory"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { LoadedStore, Refreshed } from "./types.ts"

export async function refreshLoaded(loaded: LoadedStore, context: MemoryOperationContext): Promise<Refreshed> {
  const blocks: string[] = []
  const replaced: ReadObservation[] = []
  const forgotten: ReadObservation[] = []
  for (const previous of loaded.all()) {
    const current = await observeRead(previous, context)
    if (memoryOperationInterruption(context)) break
    if (typeof current === "string") {
      loaded.forget(previous)
      forgotten.push(previous)
      blocks.push(invalidatedBlock(previous))
    } else if (current.hash !== previous.hash) {
      loaded.remember(current)
      replaced.push(current)
      blocks.push(replacementBlock(previous, current))
    }
  }
  return { blocks, changes: { loaded: replaced, forgotten } }
}
