import type { Static } from "typebox"

import type { Failed, Succeeded } from "#src/shared"
import type {
  CaptureActionSchema,
  CaptureDraftSchema,
  CaptureInputSchema,
  CaptureObservationSchema,
} from "./schemas.ts"

export interface CaptureCadenceSettings {
  nudgeInterval: number
  nudgeToolCalls: number
  flushMinTurns: number
  reviewEnabled: boolean
  flushOnCompact: boolean
  flushOnShutdown: boolean
}

export interface CaptureTally {
  userMessages: number
  turnsSinceReview: number
  toolCallsSinceReview: number
}

export interface FinishedTurn {
  toolCalls: number
  reviewActive: boolean
}

export interface TurnOutcome {
  tally: CaptureTally
  review: boolean
}

export type FlushMoment = "compact" | "shutdown"

export type CaptureDraft = Static<typeof CaptureDraftSchema>
export type CaptureAction = Static<typeof CaptureActionSchema>
export type CaptureInput = Static<typeof CaptureInputSchema>
export type CaptureObservation = Static<typeof CaptureObservationSchema>
export type CaptureResult = Succeeded<CaptureAction> | Failed
export type TranscriptMessage = CaptureInput["transcriptDelta"][number]

export interface AddDiscriminant {
  action: "add"
}

export type CaptureAdd = Extract<CaptureAction, AddDiscriminant>
