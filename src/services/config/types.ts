import type { ConfigRepairDraft, MemoryConfig, ParseConfigResult } from "#/domain"
import type { Failed, Succeeded } from "#/shared"

export type ConfigFailureReason = "not-configured" | "invalid-config"

export interface ConfigRefusal extends Failed {
  reason: ConfigFailureReason
  configPath: string
}

export type ReadConfigResult = Succeeded<MemoryConfig> | ConfigRefusal

export interface ConfigLocation {
  path: string
}

export interface MissingConfigSnapshot {
  state: "missing"
  hash: null
}

export interface PresentConfigSnapshot {
  state: "present"
  hash: string
  text: string
  lexicalParse: ParseConfigResult
  repair: ConfigRepairDraft
}

export type ConfigSnapshot = MissingConfigSnapshot | PresentConfigSnapshot
export type ReadConfigSnapshotResult = Succeeded<ConfigSnapshot> | Failed

export interface ConfigRegistrationLocation {
  config: MemoryConfig
  configPath: string
}

export type ConfigRegistrationLocationResult = Succeeded<ConfigRegistrationLocation> | Failed

export interface RegistrationPaths extends ConfigRegistrationLocation {
  indexPath: string
}

export type RegistrationPathsResult = Succeeded<RegistrationPaths> | Failed

export interface WriteConfigRequest {
  path: string
  indexPath: string
  config: MemoryConfig
  expectedHash: string | null
  replacementConfirmed?: true
}

export interface ConfigPublication {
  hash: string
}

export interface ConfigWritten extends Succeeded<ConfigPublication> {
  warnings: string[]
}

export type ConfigWriteFailureReason = "conflict" | "invalid-config" | "replacement-required" | "unavailable"

export interface ConfigWriteRefusal extends Failed {
  reason: ConfigWriteFailureReason
  warnings: string[]
}

export type WriteConfigResult = ConfigWritten | ConfigWriteRefusal
export type CheckConfigSnapshotResult = Succeeded<ConfigSnapshot> | ConfigWriteRefusal

export interface ConfigPublicationRequest {
  request: WriteConfigRequest
  temporaryPath: string
  warnings: string[]
}
