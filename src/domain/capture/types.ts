import type { Static } from "typebox"

import type { Failed, Succeeded } from "#src/shared"
import type {
  CaptureActionSchema,
  CaptureDraftSchema,
  CaptureInputSchema,
  CaptureObservationSchema,
} from "./schemas.ts"

export type CaptureDraft = Static<typeof CaptureDraftSchema>
export type CaptureAction = Static<typeof CaptureActionSchema>
export type CaptureInput = Static<typeof CaptureInputSchema>
export type CaptureObservation = Static<typeof CaptureObservationSchema>
export type CaptureResult = Succeeded<CaptureAction> | Failed

export interface AddDiscriminant {
  action: "add"
}

export type CaptureAdd = Extract<CaptureAction, AddDiscriminant>
