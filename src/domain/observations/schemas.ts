import Type from "typebox"

export const StoredObservationSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    timestamp: Type.String({ minLength: 1 }),
    content: Type.String({ minLength: 1 }),
    sourceEntryIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
    tokenCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
)

export const ObservationCommitSchema = Type.Object(
  {
    sourceEntryIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
    observations: Type.Array(StoredObservationSchema),
  },
  { additionalProperties: false },
)
