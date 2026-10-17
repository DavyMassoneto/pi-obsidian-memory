import type { ShellEditQuestions, ShellEditScores, ShellEditState } from "#src/domain"
import type { Failed, Succeeded } from "#src/shared"

export interface ShellEditPrompt {
  state: ShellEditState
  questions: ShellEditQuestions
}

export interface ShellEditModelReference {
  provider: "typesafe"
  id: string
}

export interface ShellEditClassifyOptions {
  signal: AbortSignal
  maxRetries: 0
}

export interface ShellEditClassifyRequest {
  model: ShellEditModelReference
  context: ShellEditPrompt
  options: ShellEditClassifyOptions
}

export interface ShellEditJevAnswer {
  type: string
  probability?: number
}

export interface ShellEditJevAnswers {
  redirection?: ShellEditJevAnswer
  in_place?: ShellEditJevAnswer
  inline_code?: ShellEditJevAnswer
  script_writes?: ShellEditJevAnswer
  copy_download?: ShellEditJevAnswer
  hardlink?: ShellEditJevAnswer
}

export interface ShellEditClassifierResult {
  model: string
  answers: ShellEditJevAnswers
  stopReason: "stop" | "error" | "aborted"
  errorMessage?: string
}

export interface ShellEditClassifierPort {
  classify(request: ShellEditClassifyRequest): Promise<ShellEditClassifierResult>
}

export interface ShellEditAskCall {
  classifier: ShellEditClassifierPort
  state: ShellEditState
  signal: AbortSignal
}

export interface ShellEditClassification {
  scores: ShellEditScores
  reportedModel: string
}

export type ShellEditAskResult = Succeeded<ShellEditClassification> | Failed
