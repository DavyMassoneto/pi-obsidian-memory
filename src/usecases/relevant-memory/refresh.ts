import { type InvalidReason, invalidatedBlock, type ReadObservation, replacementBlock } from "#src/services"
import { observeLoadedNote, type UnreadableNote } from "#src/usecases/capture-memory"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { LoadedStore, Refreshed } from "./types.ts"

export async function refreshLoaded(loaded: LoadedStore, context: MemoryOperationContext): Promise<Refreshed> {
  const blocks: string[] = []
  const replaced: ReadObservation[] = []
  const forgotten: ReadObservation[] = []
  for (const previous of loaded.all()) {
    const current = await observeLoadedNote(previous, context)
    if (memoryOperationInterruption(context)) break
    if (current.kind === "unreadable") {
      loaded.forget(previous)
      forgotten.push(previous)
      blocks.push(invalidatedBlock(previous, invalidReason(current)))
    } else if (current.hash !== previous.hash) {
      loaded.remember(current)
      replaced.push(current)
      blocks.push(replacementBlock(previous, current))
    }
  }
  return { blocks, changes: { loaded: replaced, forgotten } }
}

function invalidReason(unreadable: UnreadableNote): InvalidReason {
  if (unreadable.existence === "gone") return { kind: "gone" }
  if (unreadable.existence === "present") return { kind: "unusable", problem: unreadable.detail }
  return { kind: "unreadable", problem: unreadable.detail }
}
