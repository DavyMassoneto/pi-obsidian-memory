export interface WorldOptions {
  memory: "none" | "configured"
  tools: string[]
  modelCache: "fresh" | "shared"
  capture: "after-each-turn" | "at-session-end"
  credentials?: "pi-login" | "none"
  startIn?: "project" | "subfolder"
  session?: "in-memory" | "saved"
  withoutTypesafeKey?: true
  offlineNpm?: true
  installed?: true
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
