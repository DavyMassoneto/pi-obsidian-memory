import type { ChatModelCheck, ChatModelPort, MemoryScope, VaultDiagnosis } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface DiagnoseMemoryRequest<TModel> {
  port: ChatModelPort<TModel>
  embeddings: EmbeddingProbe
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
  embeddings: EmbeddingReport
}

export type DiagnoseMemoryResult = Succeeded<DiagnosedMemory> | MemoryResolutionRefusal

export interface EmbeddingProbe {
  modelCachePath: string
  hasCredentials(provider: string): Promise<boolean>
}

export interface EmbeddingReady {
  provider: string
  model: string
  status: "ready"
}

export interface EmbeddingProblem {
  provider: string
  model: string
  status: "model-not-downloaded" | "model-damaged" | "no-credentials"
  problem: string
}

export type EmbeddingReport = EmbeddingReady | EmbeddingProblem
