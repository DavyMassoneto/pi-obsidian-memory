import { describe, expect, it } from "vitest"

import { parseGoogleEmbedding, parseOpenAIEmbeddings } from "#src/services"
import { embeddingVector, openAIResponse } from "#test-helpers"

describe("parseOpenAIEmbeddings", () => {
  it("rejects wrong model, out-of-range indices, nonfinite and zero vectors", () => {
    expect(parseOpenAIEmbeddings(openAIResponse([2]), 1)).toEqual({ succeeded: false, status: "invalid-response" })
    expect(parseOpenAIEmbeddings(openAIResponse([0]).replace("3-small", "3-large"), 1)).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    expect(parseOpenAIEmbeddings(openAIResponse([0]).replace("[2,", "[1e999,"), 1)).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    expect(parseOpenAIEmbeddings(openAIResponse([0]).replace("[2,", "[0,"), 1)).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
  })
})

describe("parseGoogleEmbedding", () => {
  it("accepts exact optional token usage and rejects unsupported payload fields", () => {
    const embedding = { values: embeddingVector(768) }
    const usageMetadata = { promptTokenCount: 2, promptTokenDetails: [{ modality: "TEXT", tokenCount: 2 }] }
    expect(parseGoogleEmbedding(JSON.stringify({ embedding, usageMetadata })).succeeded).toBe(true)
    expect(parseGoogleEmbedding(JSON.stringify({ embedding, hidden: { arbitrary: "payload" } }))).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    expect(
      parseOpenAIEmbeddings(openAIResponse([0]).replace('"object":"list"', '"extra":{},"object":"list"'), 1),
    ).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
  })

  it("refuses full-dimension, nonnumeric and zero vectors", () => {
    expect(parseGoogleEmbedding(JSON.stringify({ embedding: { values: embeddingVector(3072) } }))).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    const zero = Array<number>(768).fill(0)
    expect(parseGoogleEmbedding(JSON.stringify({ embedding: { values: zero } }))).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
    expect(parseGoogleEmbedding(JSON.stringify({ embedding: { values: ["1", ...zero.slice(1)] } }))).toEqual({
      succeeded: false,
      status: "invalid-response",
    })
  })
})
