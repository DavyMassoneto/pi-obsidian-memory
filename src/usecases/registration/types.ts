import type {
  ChatModelReference,
  ConfigRefusal,
  ConfigRepairDraft,
  ConfigSnapshot,
  ConfigWriteRefusal,
  MemoryConfig,
  MemoryScope,
  ProjectEntry,
  SetupDisclosure,
  VaultBootstrapFailure,
  VaultBootstrapProgress,
  WriteConfigRequest,
} from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryContext } from "#src/usecases/add-memory"
import type { MemorySession, OperationStamp } from "#src/usecases/session"

export type {
  ChatModelReference,
  ConfigRepairDraft,
  ConfigSnapshot,
  MemoryConfig,
  SetupDisclosure,
  VaultBootstrapProgress,
} from "#src/services"

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

export type SetupVaultMode = "create" | "attach"

export interface SetupProposalRequest {
  draft: ConfigRepairDraft
  vault: string
  mode: SetupVaultMode
}

export interface ProposedSetup {
  config: MemoryConfig
  disclosures: SetupDisclosure[]
}

export type SetupProposalResult = Succeeded<ProposedSetup> | Failed

export interface InitPreparation {
  expectedHash: string
  existing: ProjectEntry | null
  defaultName: string
  takenNames: string[]
}

export type InitPreparationResult = Succeeded<InitPreparation> | ConfigRefusal

export type ProjectNameResult = Succeeded<string> | Failed
