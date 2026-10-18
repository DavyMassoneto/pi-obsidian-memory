import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import type { CaptureSettingsResult } from "./types.ts"

export async function captureSettings(context: MemoryOperationContext): Promise<CaptureSettingsResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { capture } = resolved.output.config
  return {
    succeeded: true,
    output: {
      nudgeInterval: capture.nudgeInterval,
      nudgeToolCalls: capture.nudgeToolCalls,
      flushMinTurns: capture.flushMinTurns,
      reviewEnabled: capture.reviewEnabled,
      flushOnCompact: capture.flushOnCompact,
      flushOnShutdown: capture.flushOnShutdown,
    },
  }
}
