import { DEFAULT_COMPACTION, DEFAULT_CONSOLIDATOR, DEFAULT_OBSERVER, readConfigSnapshot } from "#src/services"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import type { CycleSettingsResult } from "./types.ts"

export async function cycleSettings(context: MemoryOperationContext): Promise<CycleSettingsResult> {
  const { configPath, platform, cycleModel } = context
  const snapshot = await readConfigSnapshot({ path: configPath, platform })
  const interrupted = memoryOperationInterruption(context)
  if (interrupted) return interrupted
  if (!snapshot.succeeded) return { ...snapshot, reason: "config-unavailable", configPath }
  if (snapshot.output.state === "missing") {
    if (!cycleModel) {
      return {
        succeeded: false,
        reason: "not-configured",
        configPath,
        problems: ["No active pi model for the memory cycle"],
      }
    }
    return {
      succeeded: true,
      output: {
        observer: { ...DEFAULT_OBSERVER, model: cycleModel },
        compaction: DEFAULT_COMPACTION,
        consolidator: { ...DEFAULT_CONSOLIDATOR, model: cycleModel },
        vaultConfigured: false,
      },
    }
  }
  const config = snapshot.output.lexicalParse
  if (!config.succeeded) return { ...config, reason: "invalid-config", configPath }
  const { observer, compaction, consolidator } = config.output
  return { succeeded: true, output: { observer, compaction, consolidator, vaultConfigured: true } }
}
