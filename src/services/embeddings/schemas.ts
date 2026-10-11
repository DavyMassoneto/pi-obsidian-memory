import Type from "typebox"

export const OpenAIEmbeddingResponseSchema = Type.Object(
  {
    object: Type.Literal("list"),
    model: Type.Literal("text-embedding-3-small"),
    data: Type.Array(
      Type.Object(
        {
          object: Type.Literal("embedding"),
          index: Type.Integer({ minimum: 0 }),
          embedding: Type.Array(Type.Number(), { minItems: 1536, maxItems: 1536 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 32 },
    ),
    usage: Type.Object(
      { prompt_tokens: Type.Integer({ minimum: 0 }), total_tokens: Type.Integer({ minimum: 0 }) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
)

const GoogleEmbeddingUsageSchema = Type.Object(
  {
    promptTokenCount: Type.Optional(Type.Integer({ minimum: 0 })),
    promptTokenDetails: Type.Optional(
      Type.Array(
        Type.Object(
          { modality: Type.Literal("TEXT"), tokenCount: Type.Integer({ minimum: 0 }) },
          { additionalProperties: false },
        ),
      ),
    ),
  },
  { additionalProperties: false },
)

export const GoogleEmbeddingResponseSchema = Type.Object(
  {
    embedding: Type.Object(
      {
        values: Type.Array(Type.Number(), { minItems: 768, maxItems: 768 }),
        shape: Type.Optional(Type.Array(Type.Integer({ minimum: 1 }), { maxItems: 4 })),
      },
      { additionalProperties: false },
    ),
    usageMetadata: Type.Optional(GoogleEmbeddingUsageSchema),
  },
  { additionalProperties: false },
)
