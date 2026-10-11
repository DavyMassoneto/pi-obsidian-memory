import type { Static } from "typebox"

import type { Absent, Failed, Succeeded } from "#/shared"
import type { MemoryConfigSchema, ProjectEntrySchema } from "./schemas.ts"

export type MemoryConfig = Static<typeof MemoryConfigSchema>

export type ProjectEntry = Static<typeof ProjectEntrySchema>

export type ParseConfigResult = Succeeded<MemoryConfig> | Failed

export type ResolveProjectResult = Succeeded<ProjectEntry> | Absent

export interface ConfigFields {
  global: Partial<MemoryConfig["global"]>
  projects: Partial<ProjectEntry>[]
  limits: Partial<MemoryConfig["limits"]>
}

export interface ConfigRepairDraft extends ConfigFields {
  limits: MemoryConfig["limits"]
  replacementRequired: boolean
  problems: string[]
}

export interface SetupProposal {
  config: ConfigFields
  vault: string
}

export interface InitProposal {
  config: MemoryConfig
  folder: string
  name: string
  vault: string
}

export interface ConfigLocationPaths {
  config: ConfigFields
  configPath: string
}

export interface ConfigInfrastructure extends ConfigLocationPaths {
  indexPath: string
}

export interface VaultRegistration {
  field: string
  path: string
}
