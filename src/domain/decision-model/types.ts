export interface CandidateIdentity {
  vault: "global" | "project"
  id: string
  revision: string
}

export interface DecisionRequest {
  message: string
  project: string | null
  folder: string
}

export interface CandidateContent {
  statement: string
  body: string
}

export interface CandidateDecisionRequest {
  message: string
  identity: CandidateIdentity
  candidate: CandidateContent
}

export interface CandidateScore {
  identity: CandidateIdentity
  probability: number
}

export interface DecisionUsage {
  inputTokens: number
  outputTokens: number
}

export interface DecisionDiagnostics {
  provider: "laya" | "typesafe"
  requestedModel: string
  reportedModel: string | null
  usage: DecisionUsage | null
}

export interface RelevanceDecision {
  probability: number
  diagnostics: DecisionDiagnostics
}

export type DecisionFailureCode =
  | "unsafe-endpoint"
  | "invalid-settings"
  | "unavailable"
  | "http-error"
  | "invalid-response"
  | "routing-missing"
  | "truncated"
  | "collapsed-options"
  | "aborted"

export interface DecisionFailure {
  succeeded: false
  code: DecisionFailureCode
  diagnostics: DecisionDiagnostics
  httpStatus?: number
  detail?: string
}

export interface DecisionSuccess {
  succeeded: true
  output: RelevanceDecision
}

export type DecisionResult = DecisionSuccess | DecisionFailure

export type DecisionProvider = DecisionDiagnostics["provider"]

export interface DecisionCutoffs {
  gate: number
  relevance: number
}
