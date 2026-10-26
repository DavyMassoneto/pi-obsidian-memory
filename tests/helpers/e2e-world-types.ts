import type { MemoryConfig } from "#src/domain"

export interface CycleOverrides {
  observer?: Partial<MemoryConfig["observer"]>
  compaction?: Partial<MemoryConfig["compaction"]>
}

export interface CompactionSettings {
  keepRecentTokens: number
}

export interface AgentSettings {
  packages?: string[]
  compaction?: CompactionSettings
}

export interface WorldOptions {
  memory: "none" | "configured"
  tools: string[]
  modelCache: "fresh" | "shared"
  credentials?: "pi-login" | "none"
  startIn?: "project" | "subfolder"
  session?: "in-memory" | "saved"
  withoutTypesafeKey?: true
  offlineNpm?: true
  installed?: true
  compactsSmallSessions?: true
  cycle?: CycleOverrides
}

export interface WorldFolders {
  root: string
  agentDir: string
  cwd: string
  startFolder: string
  globalVault: string
  projectVault: string
  configPath: string
}
