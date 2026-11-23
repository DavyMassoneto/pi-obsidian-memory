import type {
  AttributionCheck,
  CaptureInput,
  CaptureResult,
  ChatModelReference,
  CheckedObservation,
  MaterialItem,
  MaterialSource,
  ObserverDraft,
  RectifiedObservation,
  Repair,
  RetrievalInput,
  RetrievalResult,
  ThinkingLevel,
  UserWords,
  UserWordsCheck,
} from "#src/domain"
import type { Failed, Succeeded } from "#src/shared"

export interface ModelStepContext {
  signal: AbortSignal
  model: ChatModelReference
}

export type CaptureKind = "consolidate" | "import"

export interface CaptureRequest extends ModelStepContext, CaptureInput {
  kind: CaptureKind
  thinking: ThinkingLevel
}
export interface RetrievalRequest extends ModelStepContext, RetrievalInput {}

export interface ObserveRequest extends ModelStepContext {
  thinking: ThinkingLevel
  chunk: string
  now: string
}

export interface UserWordsRequest extends ModelStepContext {
  thinking: ThinkingLevel
  check: UserWordsCheck
}

export interface RepairRequest extends ModelStepContext {
  thinking: ThinkingLevel
  sources: MaterialSource[]
  observations: CheckedObservation[]
}

export interface AttributionRequest extends ModelStepContext {
  thinking: ThinkingLevel
  check: AttributionCheck
}

export interface JourneyRequest extends ModelStepContext {
  thinking: ThinkingLevel
  journey: string
  material: MaterialItem[]
  corrections: MaterialItem[]
  targetTokens: number
  now: string
}

export interface PromptContent {
  system: string
  data: string
}

export interface CompletionRequest extends PromptContent {
  signal: AbortSignal
  model: ChatModelReference
  thinking?: ThinkingLevel
}

export interface CompletedResponse {
  status: "completed"
  text: string
}

export interface FailedResponse {
  status: "error" | "aborted" | "empty" | "unsupported"
  error?: string
}

export type CompletionPort = (request: CompletionRequest) => Promise<CompletedResponse | FailedResponse>
export interface ModelCallFailure extends Failed {
  modelCall: true
}

export type CompletionResult = Succeeded<string> | Failed | ModelCallFailure
export type CaptureStepResult = CaptureResult | ModelCallFailure
export type RetrievalStepResult = RetrievalResult | ModelCallFailure
export type JourneyStepResult = Succeeded<string> | Failed | ModelCallFailure
export type ObserveStepResult = Succeeded<ObserverDraft[]> | Failed | ModelCallFailure
export type UserWordsStepResult = Succeeded<UserWords> | Failed | ModelCallFailure
export type AttributionStepResult = Succeeded<RectifiedObservation[]> | Failed | ModelCallFailure
export type RepairStepResult = Succeeded<Repair[]> | Failed | ModelCallFailure
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
  ChatModelReference,
  MemoryIdentity,
  MemoryObservation,
  ReadObservation,
  RetrievalAction,
  RetrievalInput,
  RetrievalObservation,
  RetrievalResult,
} from "#src/domain"

export interface ChatModelAuthResolved {
  ok: true
}

export interface ChatModelAuthRefused {
  ok: false
  error: string
}

export type ChatModelAuth = ChatModelAuthResolved | ChatModelAuthRefused
export type ChatModelAuthLookup<TModel> = (model: TModel) => Promise<ChatModelAuth>

export interface ChatModelPort<TModel> {
  find(provider: string, id: string): TModel | undefined
  configured(model: TModel): boolean
  auth: ChatModelAuthLookup<TModel>
}

export interface ChatModelAvailable {
  model: ChatModelReference
  status: "ok"
}

export interface ChatModelUnavailable {
  model: ChatModelReference
  status: "model-not-found" | "no-credentials"
  problem: string
}

export type ChatModelCheck = ChatModelAvailable | ChatModelUnavailable
