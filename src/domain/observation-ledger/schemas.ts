import Type from "typebox"

import { ObservationIdSchema, WorkStateItemSchema } from "#src/domain/observation-ledger/origin"
import { COMPACTION_DETAILS_TYPE } from "./constants.ts"

export const LedgerObservationSchema = Type.Object(
  {
    id: ObservationIdSchema,
    content: Type.String({ minLength: 1, pattern: "^[^\\r\\n]+$" }),
    tokens: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)

export const ObservationsRecordedSchema = Type.Object(
  {
    fromId: Type.String({ minLength: 1 }),
    coversUpToId: Type.String({ minLength: 1 }),
    observations: Type.Array(LedgerObservationSchema),
  },
  { additionalProperties: false },
)

export const ObservationsConsolidatedSchema = Type.Object(
  { observationIds: Type.Array(ObservationIdSchema, { minItems: 1 }), journey: Type.String() },
  { additionalProperties: false },
)

export const WorkStateChangeSchema = Type.Object(
  {
    sourceId: ObservationIdSchema,
    text: Type.Union([WorkStateItemSchema.properties.text, Type.Null()]),
    replaces: Type.Array(Type.Integer({ minimum: 0 }), { uniqueItems: true }),
  },
  { additionalProperties: false },
)

export const JourneyReplySchema = Type.Object(
  { journey: Type.String(), workState: Type.Array(WorkStateChangeSchema) },
  { additionalProperties: false },
)

export const ObserverDraftSchema = Type.Object(
  {
    timestamp: Type.String({ pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$" }),
    content: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
)

export const ObserverReplySchema = Type.Object(
  { observations: Type.Array(ObserverDraftSchema) },
  { additionalProperties: false },
)

export const CompactionDetailsSchema = Type.Object({ type: Type.Literal(COMPACTION_DETAILS_TYPE) })
