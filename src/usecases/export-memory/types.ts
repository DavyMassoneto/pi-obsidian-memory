import type { MemoryScope, NewFileRefusal, VaultExportFile } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { PathPlatform } from "#src/usecases/check-vault-access"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface ExportMemoryRequest {
  folder: string
  fileName: string
  platform: PathPlatform
}

export interface ExportedMemory {
  path: string
  files: number
  vaults: MemoryScope[]
}

export interface ExportRefusal extends Failed {
  reason: "invalid" | "inside-vault" | "unreadable-files"
}

export type ExportMemoryResult = Succeeded<ExportedMemory> | MemoryResolutionRefusal | ExportRefusal | NewFileRefusal

export interface CollectedVaults {
  global: VaultExportFile[]
  project: VaultExportFile[] | null
  problems: string[]
}
