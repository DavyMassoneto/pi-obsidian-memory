import type { ModelRegistry, SessionEntry } from "@earendil-works/pi-coding-agent"

export type NotifyLevel = "info" | "warning" | "error"

export interface DialogOptions {
  timeout?: number
  signal?: AbortSignal
}

export interface MemoryUi {
  select(title: string, options: string[]): Promise<string | undefined>
  confirm(title: string, message: string): Promise<boolean>
  input(title: string, placeholder?: string, options?: DialogOptions): Promise<string | undefined>
  notify(message: string, type?: NotifyLevel): void
  setStatus(key: string, text: string | undefined): void
}

export type StatusWork<Result> = () => Promise<Result>

export interface MemoryStatus {
  key: string
  text: string
}

export interface ModelPrice {
  input: number
  output: number
}

export interface ChatModelSource {
  provider: string
  id: string
  cost?: ModelPrice
}

export type RegistryContext = Parameters<ModelRegistry["complete"]>[1]

export type RegistryOptions = Parameters<ModelRegistry["complete"]>[2]

export type RegistryMessage = Awaited<ReturnType<ModelRegistry["complete"]>>

export type ClassifierModelRef = Parameters<ModelRegistry["classify"]>[0]

export type ClassifierPrompt = Parameters<ModelRegistry["classify"]>[1]

export type ClassifierOptions = Parameters<ModelRegistry["classify"]>[2]

export type ClassifierOutcome = Awaited<ReturnType<ModelRegistry["classify"]>>

export interface ModelAuthResolved {
  ok: true
}

export interface ModelAuthRefused {
  ok: false
  error: string
}

export type ModelAuthResult = ModelAuthResolved | ModelAuthRefused

export interface AvailableModels {
  getAvailable(): ChatModelSource[]
  find(provider: string, modelId: string): ChatModelSource | undefined
  getApiKeyAndHeaders(model: ChatModelSource): Promise<ModelAuthResult>
  getApiKeyForProvider(provider: string): Promise<string | undefined>
  findOfType(type: "classifier", provider: string, modelId: string): ClassifierModelRef | undefined
  classify(model: ClassifierModelRef, prompt: ClassifierPrompt, options: ClassifierOptions): Promise<ClassifierOutcome>
  complete(model: ChatModelSource, context: RegistryContext, options: RegistryOptions): Promise<RegistryMessage>
}

export interface SessionIdSource {
  getSessionId(): string
  getBranch(): SessionEntry[]
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
