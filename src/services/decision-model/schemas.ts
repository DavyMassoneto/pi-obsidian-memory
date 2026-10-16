import Type from "typebox"

export const ProbabilitySchema = Type.Number({ minimum: 0, maximum: 1 })
const TokenCountSchema = Type.Integer({ minimum: 0 })
export const DecisionModelNameSchema = Type.String({ minLength: 1, maxLength: 200, pattern: "^[a-zA-Z0-9_./:-]+$" })
const NoulAnswerSchema = Type.Object({ type: Type.Literal("noul"), noul: ProbabilitySchema })

const LayaUsageSchema = Type.Object({
  input_tokens: TokenCountSchema,
  output_tokens: TokenCountSchema,
  options: Type.Optional(Type.Object({})),
})

export const LayaResponseSchema = Type.Object({
  answers: Type.Object(
    {
      needed: Type.Optional(NoulAnswerSchema),
      relevant: Type.Optional(NoulAnswerSchema),
    },
    { additionalProperties: false },
  ),
  usage: LayaUsageSchema,
  routing: Type.Optional(Type.Object({ model: DecisionModelNameSchema, reason: Type.String() })),
})

export const LayaHttpDetailSchema = Type.Object({ detail: Type.String({ minLength: 1 }) })
export const LayaResultCandidateSchema = Type.Object({})
export const LayaBatchResponseSchema = Type.Object({ results: Type.Array(LayaResultCandidateSchema) })

const JevAnswerSchema = Type.Object({ type: Type.String(), probability: Type.Optional(ProbabilitySchema) })

export const JevResultSchema = Type.Object(
  {
    stopReason: Type.Union([Type.Literal("stop"), Type.Literal("error"), Type.Literal("aborted")]),
    model: DecisionModelNameSchema,
    answers: Type.Object({
      needed: Type.Optional(JevAnswerSchema),
      relevant: Type.Optional(JevAnswerSchema),
    }),
    usage: Type.Optional(Type.Object({ input: TokenCountSchema, output: TokenCountSchema })),
  },
  { additionalProperties: true },
)
