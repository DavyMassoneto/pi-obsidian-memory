import Type from "typebox"

export const ObserverDraftSchema = Type.Object(
  {
    content: Type.String({ minLength: 1, pattern: "\\S" }),
    sourceEntryIds: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
  },
  { additionalProperties: false },
)

export const ObserverReplySchema = Type.Object(
  { observations: Type.Array(ObserverDraftSchema) },
  { additionalProperties: false },
)
