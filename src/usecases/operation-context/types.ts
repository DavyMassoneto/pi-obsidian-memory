import type { PathPlatform } from "#src/services"
import type { Failed } from "#src/shared"
import type { SemanticSource } from "#src/usecases/semantic-port"
import type { MemorySession, OperationStamp } from "#src/usecases/session"

export interface MemoryOperationContext {
  configPath: string
  workingFolder: string
  indexPath: string
  platform: PathPlatform
  session: MemorySession
  stamp: OperationStamp
  signal: AbortSignal
  semantic?: SemanticSource
}

export interface MemoryOperationRefusal extends Failed {
  reason: "cancelled" | "stale-session" | "admission-refused"
}
