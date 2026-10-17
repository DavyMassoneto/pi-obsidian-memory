import type { Static } from "typebox"

import type { Failed, Succeeded } from "#src/shared"
import type {
  AgentContextSchema,
  IdentitySchema,
  ObservationSchema,
  ReadActionSchema,
  ReadObservationSchema,
  RetrievalActionSchema,
  RetrievalInputSchema,
  RetrievalObservationSchema,
  RetrievalRefusedSchema,
} from "./schemas.ts"

export type AgentContext = Static<typeof AgentContextSchema>
export type MemoryIdentity = Static<typeof IdentitySchema>
export type MemoryObservation = Static<typeof ObservationSchema>
export type RefusedStep = Static<typeof RetrievalRefusedSchema>
export type RetrievalObservation = Static<typeof RetrievalObservationSchema>
export type ReadObservation = Static<typeof ReadObservationSchema>
export type ReadAction = Static<typeof ReadActionSchema>
export type RetrievalAction = Static<typeof RetrievalActionSchema>
export type RetrievalInput = Static<typeof RetrievalInputSchema>
export type RetrievalResult = Succeeded<RetrievalAction> | Failed
