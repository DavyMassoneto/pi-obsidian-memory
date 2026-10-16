import type { SemanticAvailable } from "#src/usecases/semantic-port"

export type LocalModelStatus = "cached" | "missing" | "invalid"

export type RemoteProvider = "openai" | "google"

export interface LocalSemanticOptions {
  cachePath: string
}

export interface LocalSemantic {
  port: SemanticAvailable
  dispose(): Promise<void>
}

export interface LocalModelAccess {
  check(cachePath: string, signal: AbortSignal): Promise<LocalModelStatus>
  create(options: LocalSemanticOptions): LocalSemantic
}
