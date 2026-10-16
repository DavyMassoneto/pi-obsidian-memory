import type { Static } from "typebox"

import type {
  CandidateContent,
  CandidateDecisionRequest,
  DecisionDiagnostics,
  DecisionRequest,
  DecisionResult,
} from "#src/domain"
import type { LayaResponseSchema } from "./schemas.ts"

export type LayaResponse = Static<typeof LayaResponseSchema>

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
  deadlineMs: number
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
  consent: "messages-and-candidates" | "not-granted"
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
  timeoutMs: number
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

export interface JevUsage {
  input: number
  output: number
}

export interface JevClassifierResult {
  stopReason: "stop" | "error" | "aborted"
  model: string
  answer: JevAnswer | null
  usage?: JevUsage
}

export interface JevClassifierPort {
  classify(request: JevClassifyRequest): Promise<JevClassifierResult>
}

export interface ProviderCall {
  prompt: DecisionPrompt
  question: "needed" | "relevant"
  signal: AbortSignal
  timeoutMs: number
  diagnostics: DecisionDiagnostics
}

export interface DecisionOperation {
  run(signal: AbortSignal): Promise<DecisionResult>
}

export interface LayaReadRequest {
  response: Response
  question: "needed" | "relevant"
  diagnostics: DecisionDiagnostics
}
