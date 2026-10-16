import { Value } from "typebox/value"
import { describe, expect, it } from "vitest"

import { EmbeddingConfigurationSchema } from "#src/domain"

describe("EmbeddingConfigurationSchema", () => {
  it("refuses mismatched models, credentials and missing provider fields", () => {
    expect(
      Value.Check(EmbeddingConfigurationSchema, { provider: "local", model: "Xenova/multilingual-e5-small" }),
    ).toBe(true)
    expect(Value.Check(EmbeddingConfigurationSchema, { provider: "local", model: "text-embedding-3-small" })).toBe(
      false,
    )
    expect(
      Value.Check(EmbeddingConfigurationSchema, {
        provider: "google",
        model: "gemini-embedding-001",
        apiKey: "synthetic",
      }),
    ).toBe(false)
    expect(Value.Check(EmbeddingConfigurationSchema, { model: "gemini-embedding-001" })).toBe(false)
  })
})
