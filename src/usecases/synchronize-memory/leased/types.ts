import type {
  CatalogPlan,
  CatalogScan,
  CatalogSnapshot,
  MemoryScope,
  NoProjectRefusal,
  SearchIndex,
  SearchIndexRefusal,
  VaultCatalogFailure,
  VaultEnumeration,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryOperationContext, MemoryOperationRefusal } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal, ResolvedVault } from "#src/usecases/resolve-memory/leased"

export interface SynchronizeMemoryRequest {
  vault: MemoryScope
}

export interface SynchronizationProgress {
  vault: MemoryScope
  revision: number
  population: CatalogSnapshot["population"]
  rebuilt: boolean
  committed: boolean
  coverage: "complete" | "degraded"
  duplicateIds: CatalogPlan["duplicateIds"]
  warnings: string[]
}

export type SynchronizationRefusal =
  | MemoryResolutionRefusal
  | NoProjectRefusal
  | SearchIndexRefusal
  | VaultCatalogFailure

export interface SynchronizationFailureProgress {
  progress: SynchronizationProgress | null
}

export type SynchronizeMemoryResult =
  | Succeeded<SynchronizationProgress>
  | (SynchronizationRefusal & SynchronizationFailureProgress)

export interface SynchronizationScan {
  catalog: CatalogScan
  enumeration: VaultEnumeration
  warnings: string[]
}

export type SynchronizationScanResult = Succeeded<SynchronizationScan> | VaultCatalogFailure | MemoryOperationRefusal

export interface CatalogSynchronization {
  context: MemoryOperationContext
  target: ResolvedVault
  index: SearchIndex
  progress: SynchronizationProgress
}

export type CatalogPublicationResult = Succeeded<CatalogPlan> | SearchIndexRefusal | MemoryOperationRefusal
