import type { VaultCatalogFailure } from "#src/domain/vault-catalog"
import type { Failed, Succeeded } from "#src/shared"

export interface VaultAsset {
  path: string
  content: string
}

export interface DashboardFilters {
  and: string[]
}

export interface DashboardView {
  type: "table"
  name: string
  filters: DashboardFilters
  order: string[]
}

export interface VaultDashboard {
  filters: DashboardFilters
  views: DashboardView[]
}

export interface VaultBootstrapProgress {
  createdRoot: boolean
  created: string[]
  preserved: string[]
  maintenanceProblems: string[]
}

export interface VaultBootstrapFailure extends Failed, VaultBootstrapProgress {
  failure: VaultCatalogFailure
}

export type VaultBootstrapResult = Succeeded<VaultBootstrapProgress> | VaultBootstrapFailure
