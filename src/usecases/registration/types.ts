import type {
  ChatModelReference,
  ConfigRefusal,
  ConfigRepairDraft,
  ConfigSnapshot,
  ConfigWriteRefusal,
  MemoryConfig,
  MemoryScope,
  VaultBootstrapFailure,
  VaultBootstrapProgress,
  WriteConfigRequest,
} from "#/services"
import type { Failed, Succeeded } from "#/shared"
import type { MemoryContext } from "#/usecases/add-memory"
import type { MemorySession, OperationStamp } from "#/usecases/session"

export type {
  ChatModelReference,
  ConfigRepairDraft,
  ConfigSnapshot,
  MemoryConfig,
  VaultBootstrapProgress,
} from "#/services"

export interface RegistrationContext extends MemoryContext {
  indexPath: string
  session: MemorySession
  stamp: OperationStamp
  signal: AbortSignal
}

export interface SetupPreparationRequest {
  selectedModel: ChatModelReference | null
}

export interface SetupPreparation {
  snapshot: ConfigSnapshot
  draft: ConfigRepairDraft
  selectedModel: ChatModelReference | null
}

export type SetupPreparationResult = Succeeded<SetupPreparation> | Failed

export interface SetupCommitRequest {
  config: MemoryConfig
  expectedHash: string | null
  replacementConfirmed: boolean
  disclosuresConfirmed: boolean
}

export type SetupCommitCaptureResult = Succeeded<SetupCommitRequest> | Failed

export interface InitCommitRequest {
  name: string
  vault: string
  expectedHash: string
}

export interface RegistrationOutcome {
  configHash: string
  assets: VaultBootstrapProgress
  warnings: string[]
}

export type RegistrationStage = "validation" | "bootstrap" | "config"
export type RegistrationCause = ConfigRefusal | ConfigWriteRefusal | VaultBootstrapFailure | Failed

export interface RegistrationFailure extends Failed {
  stage: RegistrationStage
  assets: VaultBootstrapProgress
  cause: RegistrationCause
}

export type RegistrationResult = Succeeded<RegistrationOutcome> | RegistrationFailure

export interface RegistrationPublication {
  write: WriteConfigRequest
  scope: MemoryScope
}
