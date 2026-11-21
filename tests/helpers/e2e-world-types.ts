import type { CaptureCadenceSettings } from "#src/domain"

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
  capture: "after-each-turn" | "on-compaction" | "at-session-end"
  credentials?: "pi-login" | "none"
  startIn?: "project" | "subfolder"
  session?: "in-memory" | "saved"
  withoutTypesafeKey?: true
  offlineNpm?: true
  installed?: true
  compactsSmallSessions?: true
  captureSettings?: Partial<CaptureCadenceSettings>
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
