import type { ConfigRefusal, MemoryConfig, MemoryScope, NamedVaultContext, NoProjectRefusal } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryOperationRefusal } from "#src/usecases/operation-context"

export interface ResolvedVault {
  scope: MemoryScope
  vault: NamedVaultContext
}

export interface ResolvedMemory {
  config: MemoryConfig
  configHash: string
  global: ResolvedVault
  project: ResolvedVault | null
  protectedRoots: string[]
  workingFolder: string
  indexPath: string
}

export interface MemoryConfigurationUnavailable extends Failed {
  reason: "config-unavailable"
  configPath: string
}

export type MemoryResolutionRefusal = ConfigRefusal | MemoryConfigurationUnavailable | MemoryOperationRefusal
export type ResolveMemoryResult = Succeeded<ResolvedMemory> | MemoryResolutionRefusal
export type SelectMemoryVaultResult = Succeeded<ResolvedVault> | NoProjectRefusal
