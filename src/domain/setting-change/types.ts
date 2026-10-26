import type { ChatModelReference, MemoryConfig, ThinkingLevel } from "#src/domain/config"

export interface CaptureModelChange {
  kind: "captureModel"
  model: ChatModelReference
}

export interface AgentModelChange {
  kind: "agentModel"
  model: ChatModelReference
}

export interface ObserverModelChange {
  kind: "observerModel"
  model: ChatModelReference
}

export interface ThinkingChange {
  kind: "thinking"
  role: "observer"
  value: ThinkingLevel
}

export interface ObserverCountChange {
  kind: "observerCount"
  name: "chunkTokens" | "concurrency"
  value: number
}

export interface CompactionCountChange {
  kind: "compactionCount"
  name: keyof MemoryConfig["compaction"]
  value: number
}

export interface CaptureCountChange {
  kind: "captureCount"
  name: "nudgeInterval" | "nudgeToolCalls" | "flushMinTurns"
  value: number
}

export interface CaptureSwitchChange {
  kind: "captureSwitch"
  name: "reviewEnabled" | "flushOnCompact" | "flushOnShutdown"
  value: boolean
}

export interface EmbeddingsChange {
  kind: "embeddings"
  embeddings: MemoryConfig["embeddings"]
}

export interface JevDecisionChange {
  kind: "decision"
  provider: "typesafe"
}

export interface LayaDecisionChange {
  kind: "decision"
  provider: "laya"
  endpoint: string
}

export interface ThresholdChange {
  kind: "gateThreshold" | "relevanceThreshold"
  value: number | null
}

export interface BudgetChange {
  kind: "budgetChars"
  value: number
}

export interface LimitChange {
  kind: "limit"
  name: keyof MemoryConfig["limits"]
  value: number
}

export interface ProjectVaultChange {
  kind: "projectVault"
  name: string
  vault: string
}

export interface RemoveProjectChange {
  kind: "removeProject"
  name: string
}

export type DecisionChange = JevDecisionChange | LayaDecisionChange

export type SettingChange =
  | CaptureModelChange
  | AgentModelChange
  | ObserverModelChange
  | ThinkingChange
  | ObserverCountChange
  | CompactionCountChange
  | CaptureCountChange
  | CaptureSwitchChange
  | EmbeddingsChange
  | DecisionChange
  | ThresholdChange
  | BudgetChange
  | LimitChange
  | ProjectVaultChange
  | RemoveProjectChange
