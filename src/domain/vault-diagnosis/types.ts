import type { InspectedVaultFile, VaultCatalogEntry } from "#src/domain/vault-catalog"

export interface VaultDiagnosisRequest {
  entries: readonly VaultCatalogEntry[]
  inspected: readonly InspectedVaultFile[]
}

export interface InvalidVaultNote {
  path: string
  problems: string[]
}

export interface DuplicateNoteId {
  id: string
  paths: string[]
}

export interface VaultDiagnosis {
  invalid: InvalidVaultNote[]
  blank: string[]
  duplicateIds: DuplicateNoteId[]
  temporaries: string[]
}
