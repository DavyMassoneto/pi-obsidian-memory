import type { MemoryConfig } from "#/domain"
import type { Failed, Succeeded } from "#/shared"

export type ConfigFailureReason = "not-configured" | "invalid-config"

export interface ConfigRefusal extends Failed {
  reason: ConfigFailureReason
}

export type ReadConfigResult = Succeeded<MemoryConfig> | ConfigRefusal
