import type { BeforeAgentStartEvent, BeforeAgentStartEventResult } from "@earendil-works/pi-coding-agent"

import type { ExtensionRegistrar } from "#src/pi"
import type { CaptureAction, CaptureInput, MemoryConfig, RetrievalAction, RetrievalInput } from "#src/services"

export interface LimitsInput {
  maxBodyChars: number | string
  maxStatementChars: number
  maxTags?: number
}

export interface TurnOutcome {
  sections: BeforeAgentStartEvent["systemPromptOptions"]["sections"]
  message: BeforeAgentStartEventResult["message"] | null
}

export type RegistrarSetup = (registrar: ExtensionRegistrar) => void

export type StepFunction = (input: CaptureInput) => CaptureAction | Promise<CaptureAction>

export type ScriptStep = CaptureAction | StepFunction
export type Check = () => void | Promise<void>

export interface LayaAsk {
  question: "needed" | "relevant"
  message: string
  statement: string | null
}

export type LayaScript = (ask: LayaAsk) => number | null

export interface LayaQuestionBody {
  instructions: string
}

export interface LayaQuestionsBody {
  needed?: LayaQuestionBody
  relevant?: LayaQuestionBody
}

export interface LayaCandidateBody {
  statement: string
}

export interface LayaStateBody {
  message: string
  candidate?: LayaCandidateBody
}

export interface LayaRequestBody {
  questions: LayaQuestionsBody
  state: LayaStateBody
  states?: LayaStateBody[]
}

export type RetrievalStepFunction = (input: RetrievalInput) => RetrievalAction

export type RetrievalStep = RetrievalAction | RetrievalStepFunction

export interface RelevantPiOptions {
  laya: LayaScript | null
  endpoint?: string
  decisionModel?: MemoryConfig["decisionModel"]
  budgetChars?: number
  session: RetrievalStep[]
  turns: RetrievalStep[]
}

export type Done = () => boolean

export type TurnMessage = NonNullable<TurnOutcome["message"]>
