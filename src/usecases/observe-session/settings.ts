import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import type { CycleSettingsResult } from "./types.ts"

export async function cycleSettings(context: MemoryOperationContext): Promise<CycleSettingsResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { observer, compaction } = resolved.output.config
  return { succeeded: true, output: { observer, compaction } }
}
