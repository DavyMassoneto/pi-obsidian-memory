import type { VaultBootstrapProgress, VaultCatalogFailure } from "#src/domain"
import type { Succeeded } from "#src/shared"

export type { VaultBootstrapFailure, VaultBootstrapProgress, VaultBootstrapResult } from "#src/domain"

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
