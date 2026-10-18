import type { ConfigRepairDraft, MemoryConfig, ParseConfigResult, PathPlatform } from "#src/domain"
import type { Failed, Succeeded } from "#src/shared"

export type ConfigFailureReason = "not-configured" | "invalid-config" | "unreadable"

export interface ConfigRefusal extends Failed {
  reason: ConfigFailureReason
  configPath: string
}

export interface ConfigUnreadable extends ConfigRefusal {
  reason: "unreadable"
  code: string
}

export type ReadConfigResult = Succeeded<MemoryConfig> | ConfigRefusal | ConfigUnreadable

export interface ConfigLocation {
  path: string
  platform: PathPlatform
}

export interface RegistrationVaultInput {
  vault: string
  workingFolder: string
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
  platform: PathPlatform
}

export type ConfigRegistrationLocationResult = Succeeded<ConfigRegistrationLocation> | Failed

export interface RegistrationPaths extends ConfigRegistrationLocation {
  indexPath: string
}

export type RegistrationPathsResult = Succeeded<RegistrationPaths> | Failed
export type CanonicalPathResult = Succeeded<string> | Failed
export type CanonicalConfigResult = Succeeded<MemoryConfig> | Failed

export interface WriteConfigRequest extends ConfigLocation {
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

export interface PathIdentity {
  device: string
  inode: string
}

export type FileIdentityResult = Succeeded<PathIdentity> | Failed
export type PathIdentitiesResult = Succeeded<PathIdentity[]> | Failed
