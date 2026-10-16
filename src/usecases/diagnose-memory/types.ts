import type { ChatModelCheck, ChatModelPort, MemoryScope, VaultDiagnosis } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface DiagnoseMemoryRequest<TModel> {
  port: ChatModelPort<TModel>
}

export interface BlankFile {
  path: string
  rawHash: string
  empty: boolean
}

export interface VaultReport {
  vault: MemoryScope
  diagnosis: VaultDiagnosis
  blanks: BlankFile[]
  unreadable: string[]
}

export interface VaultReportFailure {
  vault: MemoryScope
  problems: string[]
}

export interface ModelReport {
  role: "capture" | "memory agent"
  check: ChatModelCheck
}

export interface DiagnosedMemory {
  vaults: (VaultReport | VaultReportFailure)[]
  projectMissing: boolean
  maxNotesPerFolder: number
  models: ModelReport[]
}

export type DiagnoseMemoryResult = Succeeded<DiagnosedMemory> | MemoryResolutionRefusal
