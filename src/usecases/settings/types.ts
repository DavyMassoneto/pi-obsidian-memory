import type { MemoryConfig, SettingChange } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"

export type { MemoryConfig, ProjectEntry, SettingChange } from "#src/services"

export interface SettingsPreparation {
  config: MemoryConfig
  hash: string
}

export interface SettingsRefusal extends Failed {
  reason: "not-configured" | "invalid-config" | "unreadable"
}

export type SettingsPreparationResult = Succeeded<SettingsPreparation> | SettingsRefusal

export interface SettingsChangeRequest {
  change: SettingChange
  expectedHash: string
}

export interface SettingsChanged {
  configHash: string
  config: MemoryConfig
  warnings: string[]
}

export interface SettingsChangeFailure extends Failed {
  reason: "conflict" | "refused" | "cancelled"
}

export type SettingsChangeResult = Succeeded<SettingsChanged> | SettingsChangeFailure
