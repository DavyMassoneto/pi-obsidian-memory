import { type MemoryPiContext, MemorySessionKeeper, type RelevantLoader } from "#src/pi"
import { LoadedMemory } from "#src/usecases"

export function blockStart(context: MemoryPiContext, relevant: RelevantLoader) {
  const keeper = new MemorySessionKeeper()
  const operation = keeper.operationContext(
    keeper.start(context),
    "work",
    { configPath: "c", indexPath: "i" },
    undefined,
  )
  return { context: operation, configured: true, loaded: new LoadedMemory(), relevant, notify: () => {}, ctx: context }
}
