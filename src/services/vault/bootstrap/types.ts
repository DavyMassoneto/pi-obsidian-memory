import type { VaultBootstrapProgress, VaultCatalogFailure } from "#/domain"
import type { Succeeded } from "#/shared"

export type { VaultBootstrapFailure, VaultBootstrapProgress, VaultBootstrapResult } from "#/domain"

export interface AssetLocation {
  root: string
  folder: string
  name: string
}

export interface AssetWriteRequest extends AssetLocation {
  content: string
  progress: VaultBootstrapProgress
}

export type AssetPathResult = Succeeded<string> | VaultCatalogFailure
