export type NotifyLevel = "info" | "warning" | "error"

export interface MemoryUi {
  select(title: string, options: string[]): Promise<string | undefined>
  confirm(title: string, message: string): Promise<boolean>
  input(title: string, placeholder?: string): Promise<string | undefined>
  notify(message: string, type?: NotifyLevel): void
}

export interface ChatModelSource {
  provider: string
  id: string
}

export interface AvailableModels {
  getAvailable(): ChatModelSource[]
}

export interface SessionIdSource {
  getSessionId(): string
}

export interface MemoryPiContext {
  cwd: string
  hasUI: boolean
  ui: MemoryUi
  model: ChatModelSource | undefined
  modelRegistry: AvailableModels
  sessionManager: SessionIdSource
}

export interface MemoryPaths {
  configPath: string
  indexPath: string
}

export interface MemoryCommand {
  description: string
  handler(args: string, ctx: MemoryPiContext): Promise<void>
}
