import type { MemoryConfig } from "#src/domain/config"
import type { InspectedVaultFile, VaultCatalogEntry } from "#src/domain/vault-catalog"

export interface VaultDiagnosisRequest {
  entries: readonly VaultCatalogEntry[]
  inspected: readonly InspectedVaultFile[]
  limits: MemoryConfig["limits"]
}

export interface InvalidVaultNote {
  path: string
  problems: string[]
}

export interface DuplicateNoteId {
  id: string
  paths: string[]
}

export interface CrowdedFolder {
  folder: string
  count: number
}

export interface VaultDiagnosis {
  invalid: InvalidVaultNote[]
  blank: string[]
  duplicateIds: DuplicateNoteId[]
  temporaries: string[]
  crowdedFolders: CrowdedFolder[]
}
