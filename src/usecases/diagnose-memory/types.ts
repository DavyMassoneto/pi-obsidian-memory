import type { ChatModelCheck, ChatModelPort, MemoryScope, VaultDiagnosis } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { CutoffReport } from "#src/usecases/relevant-memory"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface DiagnoseMemoryRequest<TModel> {
  port: ChatModelPort<TModel>
  embeddings: EmbeddingProbe
  decision: DecisionProbe
  omLoaded: boolean
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
  role: "observer" | "memory agent"
  check: ChatModelCheck
}

export interface DiagnosedMemory {
  vaults: (VaultReport | VaultReportFailure)[]
  projectMissing: boolean
  maxNotesPerFolder: number
  models: ModelReport[]
  embeddings: EmbeddingReport
  decision: DecisionReport
  cutoffs: CutoffReport
  omLoaded: boolean
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

export interface DecisionProbe {
  hasClassifier(provider: string, model: string): boolean
  hasCredentials(provider: string): Promise<boolean>
}

export interface DecisionReady {
  provider: string
  model: string
  status: "ready"
  detail: string
}

export interface DecisionProblem {
  provider: string
  model: string
  status: "model-missing" | "no-credentials" | "not-answering"
  problem: string
}

export type DecisionReport = DecisionReady | DecisionProblem
