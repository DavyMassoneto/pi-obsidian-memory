import Type from "typebox"

export const EmbeddingConfigurationSchema = Type.Union([
  Type.Object(
    {
      provider: Type.Literal("local"),
      model: Type.Literal("Xenova/multilingual-e5-small"),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      provider: Type.Literal("openai"),
      model: Type.Literal("text-embedding-3-small"),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      provider: Type.Literal("google"),
      model: Type.Literal("gemini-embedding-001"),
    },
    { additionalProperties: false },
  ),
])
