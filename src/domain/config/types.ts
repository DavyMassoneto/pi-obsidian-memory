import type { Static, TSchema } from "typebox"

import type { Absent, Failed, Succeeded } from "#src/shared"
import type {
  ChatModelReferenceSchema,
  ConfigFieldObservationSchema,
  MemoryConfigSchema,
  ProjectEntrySchema,
  ThinkingLevelSchema,
} from "./schemas.ts"

export type MemoryConfig = Static<typeof MemoryConfigSchema>

export type ProjectEntry = Static<typeof ProjectEntrySchema>

export type ThinkingLevel = Static<typeof ThinkingLevelSchema>

export type ParseConfigResult = Succeeded<MemoryConfig> | Failed

export type ConfigFieldObservation = Static<typeof ConfigFieldObservationSchema>

export interface ConfigObservationRule {
  field: ConfigFieldObservation["field"]
  index: number
  path: string
}

export interface ConfigDocumentInspection {
  config: Succeeded<MemoryConfig> | Absent
  observations: ConfigFieldObservation[]
  projectCount: number
  shapeProblems: string[]
  invalidTokenOrder: boolean
}

export interface ConfigJsonInspection extends ConfigDocumentInspection {
  validJson: true
}

export interface ConfigSyntaxFailure {
  validJson: false
  message: string
}

export type ConfigInspection = ConfigJsonInspection | ConfigSyntaxFailure

export interface ConfigAssessment {
  lexicalParse: ParseConfigResult
  repair: ConfigRepairDraft
}

export type ResolveProjectResult = Succeeded<ProjectEntry> | Absent

export type ChatModelReference = Static<typeof ChatModelReferenceSchema>

export interface ConfigObjectRule {
  kind: "object"
  path: string
  keys: string[]
  required: string[]
}

export interface ConfigValueRule {
  kind: "value"
  path: string
  schema: TSchema
}

export type ConfigFieldRule = ConfigObjectRule | ConfigValueRule

export interface ConfigRuleSelection {
  projectCount: number
  embeddings: string | null
  decisionModel: string | null
}

export interface ConfigRegistrations {
  global: Partial<MemoryConfig["global"]>
  projects: Partial<ProjectEntry>[]
}

export interface ObserverFields extends Partial<Omit<MemoryConfig["observer"], "model">> {
  model: Partial<ChatModelReference>
}

export type CompactionFields = Partial<MemoryConfig["compaction"]>

export interface MemoryAgentFields {
  model: Partial<ChatModelReference>
}

export interface EmbeddingFields {
  provider?: MemoryConfig["embeddings"]["provider"]
  model?: MemoryConfig["embeddings"]["model"]
}

export interface DecisionFields {
  provider?: MemoryConfig["decisionModel"]["provider"]
  model?: MemoryConfig["decisionModel"]["model"]
  endpoint?: string
  maxTokens?: number
  headMaxTokens?: number
  gateThreshold?: number
  relevanceThreshold?: number
}

export interface ConfigFields extends ConfigRegistrations {
  limits: Partial<MemoryConfig["limits"]>
  observer: ObserverFields
  compaction: CompactionFields
  memoryAgent: MemoryAgentFields
  context: Partial<MemoryConfig["context"]>
  embeddings: EmbeddingFields
  decisionModel: DecisionFields
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
  config: ConfigRegistrations
  configPath: string
}

export interface ConfigInfrastructure extends ConfigLocationPaths {
  indexPath: string
}

export interface VaultRegistration {
  field: string
  path: string
}

export type SetupDisclosure = "chat-models" | "jev" | "remote-embeddings"

export type SettingNumberKind = "threshold" | "count"

export interface ConfigCandidate extends Omit<MemoryConfig, "decisionModel"> {
  decisionModel: DecisionFields
}

export type NextConfig = Succeeded<ConfigCandidate> | Failed

export type SettingNumberResult = Succeeded<number> | Failed

export type ProjectReplacement = (project: ProjectEntry) => ProjectEntry | null
