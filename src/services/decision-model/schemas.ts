import Type from "typebox"

export const ProbabilitySchema = Type.Number({ minimum: 0, maximum: 1 })
const TokenCountSchema = Type.Integer({ minimum: 0 })
export const DecisionModelNameSchema = Type.String({ minLength: 1, maxLength: 200, pattern: "^[a-zA-Z0-9_./:-]+$" })
const NoulAnswerSchema = Type.Object(
  {
    type: Type.Literal("noul"),
    noul: ProbabilitySchema,
    confidence: Type.Optional(ProbabilitySchema),
    answer_confidence: Type.Optional(ProbabilitySchema),
    action: Type.Optional(Type.Object({ act_probability: ProbabilitySchema }, { additionalProperties: false })),
    abstention: Type.Optional(
      Type.Union([Type.Literal("passed"), Type.Literal("abstained"), Type.Literal("unevaluated")]),
    ),
    abstention_threshold: Type.Optional(ProbabilitySchema),
    low_confidence: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
)

const CollapsedOptionsSchema = Type.Object(
  {
    total: TokenCountSchema,
    distinct: TokenCountSchema,
    tokens_per_option: TokenCountSchema,
  },
  { additionalProperties: false },
)

const LayaUsageSchema = Type.Object(
  {
    input_tokens: TokenCountSchema,
    output_tokens: TokenCountSchema,
    state_tokens: TokenCountSchema,
    state_tokens_dropped: TokenCountSchema,
    truncated: Type.Boolean(),
    truncated_questions: Type.Array(Type.Union([Type.Literal("needed"), Type.Literal("relevant")])),
    options: Type.Optional(
      Type.Object(
        {
          needed: Type.Optional(CollapsedOptionsSchema),
          relevant: Type.Optional(CollapsedOptionsSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

export const LayaResponseSchema = Type.Object(
  {
    model: DecisionModelNameSchema,
    answers: Type.Object(
      {
        needed: Type.Optional(NoulAnswerSchema),
        relevant: Type.Optional(NoulAnswerSchema),
      },
      { additionalProperties: false },
    ),
    usage: LayaUsageSchema,
    routing: Type.Optional(
      Type.Object(
        {
          model: DecisionModelNameSchema,
          repo: Type.Union([Type.String(), Type.Null()]),
          reason: Type.String(),
          detection: Type.Null(),
          workflow: Type.Null(),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

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
