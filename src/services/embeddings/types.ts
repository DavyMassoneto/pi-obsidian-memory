import type { EmbeddingBatchRequest, EmbeddingFailure, EmbeddingResult } from "#src/domain"
import type { Succeeded } from "#src/shared"

export type {
  EmbeddedInput,
  EmbeddingBatch,
  EmbeddingBatchRequest,
  EmbeddingConfiguration,
  EmbeddingFailure,
  EmbeddingFailureStatus,
  EmbeddingInput,
  EmbeddingResult,
} from "#src/domain"

export interface EmbeddingOperationContext {
  signal: AbortSignal
  timeoutMs: number
}

export interface RemoteEmbeddingContext extends EmbeddingOperationContext {
  apiKey: string
  endpoint?: string
}

export interface LocalRuntimeOptions {
  cachePath: string
  onProgress?: DownloadProgressListener
}

export interface DownloadProgress {
  loaded: number
  total: number
}

export type DownloadProgressListener = (progress: DownloadProgress) => void

export interface LocalModel {
  countTokens(text: string): number
  extract(text: string): Promise<readonly number[] | null>
  dispose(): Promise<void>
}

export type LocalModelLoader = (options: LocalModelOptions) => Promise<LocalModel>

export interface LocalModelOptions extends LocalRuntimeOptions {
  signal: AbortSignal
}

export interface LocalEmbeddingOptions extends LocalRuntimeOptions {
  loadModel?: LocalModelLoader
}

export interface LocalEmbedder {
  embed(context: EmbeddingOperationContext, request: EmbeddingBatchRequest): Promise<EmbeddingResult>
  dispose(): Promise<void>
}

export interface LocalEmbeddingState {
  options: LocalEmbeddingOptions
  model: Promise<LocalModel> | null
  queue: Promise<void>
  disposed: boolean
}

export type EmbeddingOperation = (signal: AbortSignal) => Promise<EmbeddingResult>
export type TextSize = (text: string) => number

export interface ChunkPolicy {
  maximum: number
  overlap: number
  measure: TextSize
  prefix: string
}

export interface PreparedChunk {
  inputIndex: number
  text: string
}

export type PreparedChunks = Succeeded<PreparedChunk[]> | EmbeddingFailure

export interface EmbeddingHttpRequest {
  endpoint: string
  apiKey: string
  provider: "openai" | "google"
  body: string
  signal: AbortSignal
}

export type EmbeddingHttpResult = Succeeded<string> | EmbeddingFailure
export type ParsedVectors = Succeeded<number[][]> | EmbeddingFailure

export type ModelAssetPath = "config.json" | "tokenizer_config.json" | "tokenizer.json" | "onnx/model_quantized.onnx"

export interface ModelAsset {
  path: ModelAssetPath
  bytes: number
  sha256: string
}

export interface ModelAssetFetchRequest {
  path: ModelAssetPath
  signal: AbortSignal
}

export type ModelAssetTransport = (request: ModelAssetFetchRequest) => Promise<Response>

export interface ModelAssetRequest {
  directory: string
  asset: ModelAsset
  signal: AbortSignal
  transport: ModelAssetTransport
  onProgress?: DownloadProgressListener
}

export type ModelCacheResult = Succeeded<string> | EmbeddingFailure
export type AssetInspection = "valid" | "missing" | "invalid"
