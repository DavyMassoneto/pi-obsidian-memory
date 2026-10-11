import type { Failed } from "#/shared"
import type { MemorySession, OperationStamp } from "#/usecases/session"

export interface MemoryOperationContext {
  configPath: string
  workingFolder: string
  indexPath: string
  session: MemorySession
  stamp: OperationStamp
  signal: AbortSignal
}

export interface MemoryOperationRefusal extends Failed {
  reason: "cancelled" | "stale-session" | "admission-refused"
}
