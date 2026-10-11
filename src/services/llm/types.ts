import type { CaptureInput, RetrievalInput } from "#/domain"
import type { Failed, Succeeded } from "#/shared"

export interface ChatModelReference {
  provider: string
  id: string
}

export interface CompletionTiming {
  signal: AbortSignal
  deadline: number
}

export interface ModelStepContext extends CompletionTiming {
  model: ChatModelReference
  round: number
}

export interface CaptureRequest extends ModelStepContext, CaptureInput {}
export interface RetrievalRequest extends ModelStepContext, RetrievalInput {}

export interface PromptContent {
  system: string
  data: string
}

export interface CompletionRequest extends CompletionTiming, PromptContent {
  model: ChatModelReference
  round: number
  maxRounds: number
  maxTokens: number
}

export interface CompletedResponse {
  status: "completed"
  text: string
}

export interface FailedResponse {
  status: "error" | "aborted" | "empty" | "unsupported"
}

export type CompletionPort = (request: CompletionRequest) => Promise<CompletedResponse | FailedResponse>
export type CompletionResult = Succeeded<string> | Failed
export type DisposeCompletion = () => void

export interface CompletionLifetime {
  signal: AbortSignal
  stopped: Promise<FailedResponse>
  dispose: DisposeCompletion
}

export type {
  AgentContext,
  CaptureAction,
  CaptureDraft,
  CaptureInput,
  CaptureObservation,
  CaptureResult,
  MemoryIdentity,
  MemoryObservation,
  ReadObservation,
  RetrievalAction,
  RetrievalInput,
  RetrievalResult,
} from "#/domain"
