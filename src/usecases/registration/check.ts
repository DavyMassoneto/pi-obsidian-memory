import { type ReadConfigResult, readConfig } from "#src/services"
import type { MemoryContext } from "#src/usecases/add-memory"

export function checkMemoryConfig(context: MemoryContext): Promise<ReadConfigResult> {
  return readConfig(context.configPath, context.platform)
}
