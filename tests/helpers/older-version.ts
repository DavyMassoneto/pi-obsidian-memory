import Type from "typebox"

const OlderObservationSchema = Type.Object(
  {
    id: Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?$" }),
    content: Type.String({ minLength: 1, pattern: "^[^\\r\\n]+$" }),
    tokens: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)

export const RecordedByOlderVersionsSchema = Type.Object(
  {
    fromId: Type.String({ minLength: 1 }),
    coversUpToId: Type.String({ minLength: 1 }),
    observations: Type.Array(OlderObservationSchema),
  },
  { additionalProperties: false },
)

export const ConsolidatedByOlderVersionsSchema = Type.Object(
  {
    observationIds: Type.Array(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?$" }), {
      minItems: 1,
    }),
    journey: Type.String(),
  },
  { additionalProperties: false },
)
