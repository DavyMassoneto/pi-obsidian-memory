import type { Static } from "typebox"

import type {
  CandidateContent,
  CandidateDecisionRequest,
  DecisionDiagnostics,
  DecisionFailureCode,
  DecisionRequest,
  DecisionResult,
} from "#src/domain"
import type { LayaResponseSchema, LayaResultCandidateSchema } from "./schemas.ts"

export type LayaResponse = Static<typeof LayaResponseSchema>
export type LayaResultCandidate = Static<typeof LayaResultCandidateSchema>

export type {
  CandidateContent,
  CandidateDecisionRequest,
  CandidateIdentity,
  CandidateScore,
  DecisionDiagnostics,
  DecisionFailure,
  DecisionFailureCode,
  DecisionRequest,
  DecisionResult,
  DecisionUsage,
  RelevanceDecision,
} from "#src/domain"

export interface DecisionLimits {
  signal: AbortSignal
}

export interface LayaContext extends DecisionLimits {
  provider: "laya"
  endpoint: string
  model: string
  maxTokens: number
  headMaxTokens: number
  apiKey?: string
}

export interface JevContext extends DecisionLimits {
  provider: "typesafe"
  model: string
  classifier: JevClassifierPort
}

export type DecisionContext = LayaContext | JevContext

export interface MemoryDecisionCall {
  context: DecisionContext
  request: DecisionRequest
}

export interface CandidateDecisionCall {
  context: DecisionContext
  request: CandidateDecisionRequest
}

export interface BoolCriteria {
  true: string
  false: string
}

export interface BoolQuestion {
  type: "bool"
  instructions: string
  criteria: BoolCriteria
}

export interface NeededQuestions {
  needed: BoolQuestion
}

export interface RelevantQuestions {
  relevant: BoolQuestion
}

export interface CandidateState {
  message: string
  candidate: CandidateContent
}

export interface DecisionPrompt {
  state: DecisionRequest | CandidateState
  questions: NeededQuestions | RelevantQuestions
}

export interface JevModelReference {
  provider: "typesafe"
  id: string
}

export interface JevClassifyOptions {
  signal: AbortSignal
  maxRetries: 0
}

export interface JevClassifyRequest {
  model: JevModelReference
  context: DecisionPrompt
  options: JevClassifyOptions
}

export interface JevAnswer {
  type: string
  probability?: number
}

export interface JevAnswers {
  needed?: JevAnswer
  relevant?: JevAnswer
}

export interface JevCost {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  total: number
}

export interface JevUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  totalTokens: number
  cost: JevCost
}

export interface JevClassifierResult {
  api: string
  provider: string
  model: string
  answers: JevAnswers
  usage?: JevUsage
  stopReason: "stop" | "error" | "aborted"
  errorMessage?: string
  timestamp: number
}

export interface JevClassifierPort {
  classify(request: JevClassifyRequest): Promise<JevClassifierResult>
}

export interface ProviderCall {
  prompt: DecisionPrompt
  question: "needed" | "relevant"
  signal: AbortSignal
  diagnostics: DecisionDiagnostics
}

export interface DecisionOperation {
  run(signal: AbortSignal): Promise<DecisionResult>
}

export interface LayaValueRequest {
  question: "needed" | "relevant"
  diagnostics: DecisionDiagnostics
}

export interface LayaReadRequest extends LayaValueRequest {
  response: Response
}

export interface DecisionBatchItem {
  prompt: DecisionPrompt
  diagnostics: DecisionDiagnostics
}

export interface LayaBatchCall {
  items: DecisionBatchItem[]
  signal: AbortSignal
}

export type DecisionInterruption<Outcome> = (code: DecisionFailureCode) => Outcome

export interface InterruptibleOperation<Outcome> {
  run(signal: AbortSignal): Promise<Outcome>
}
