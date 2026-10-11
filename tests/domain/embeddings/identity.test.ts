import { describe, expect, it } from "vitest"

import {
  embeddingFingerprint,
  googleEmbeddingConfiguration,
  localEmbeddingConfiguration,
  openAIEmbeddingConfiguration,
} from "#/domain"

describe("embeddingFingerprint", () => {
  it("separates vector spaces and states the complete local processing policy", () => {
    const local = embeddingFingerprint(localEmbeddingConfiguration)
    expect(local).toContain("761b726dd34fb83930e26aab4e9ac3899aa1fa78")
    expect(local).toContain("384")
    expect(local).toContain("mean")
    expect(local).toContain("q8")
    expect(local).toContain("query: ")
    expect(local).toContain("passage: ")
    expect(local).toContain("512")
    expect(local).toContain("32")
    expect(
      new Set([
        local,
        embeddingFingerprint(openAIEmbeddingConfiguration),
        embeddingFingerprint(googleEmbeddingConfiguration),
      ]).size,
    ).toBe(3)
  })
})
