import { expect, test } from "vitest"

import { inspectConfigForRepair, parseConfig } from "#/domain"
import { aConfig } from "#test-helpers"

test.each([
  { provider: "local", model: "Xenova/multilingual-e5-small" },
  { provider: "openai", model: "text-embedding-3-small" },
  { provider: "google", model: "gemini-embedding-001" },
])("accepts and preserves the exact embeddings alternative $provider", (embeddings) => {
  const config = { ...aConfig(), embeddings }
  expect(parseConfig(JSON.stringify(config))).toEqual({ succeeded: true, output: config })
  expect(inspectConfigForRepair(JSON.stringify(config)).embeddings).toEqual(embeddings)
})

test.each([
  { provider: "local", model: "other" },
  { provider: "openai", model: "gemini-embedding-001" },
  { provider: "google", model: "text-embedding-3-small" },
  { provider: "other", model: "Xenova/multilingual-e5-small" },
  { provider: "openai", model: "text-embedding-3-small", apiKey: "secret" },
  { provider: "local" },
])("refuses unsupported, incomplete or credential-bearing embeddings %j", (embeddings) => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), embeddings })).succeeded).toBe(false)
})

test.each([
  { provider: "typesafe", model: "jev-latest" },
  {
    provider: "laya",
    endpoint: "http://[::1]:8000/v1/systemone",
    model: "multilingual",
    maxTokens: 2048,
    headMaxTokens: 100,
  },
])("accepts and preserves the supported decision settings $provider", (decisionModel) => {
  const config = { ...aConfig(), decisionModel }
  expect(parseConfig(JSON.stringify(config))).toEqual({ succeeded: true, output: config })
  expect(inspectConfigForRepair(JSON.stringify(config)).decisionModel).toEqual(decisionModel)
})

test.each([
  "https://example.com/v1/systemone",
  "http://localhost.evil/v1/systemone",
  "http://user:pass@127.0.0.1/v1/systemone",
  "http://127.0.0.1/v1/systemone?key=secret",
  "http://127.0.0.1/v1/systemone#fragment",
  "http://127.0.0.1/other",
])("reuses decision loopback endpoint policy: %s", (endpoint) => {
  const config = {
    ...aConfig(),
    decisionModel: { provider: "laya", endpoint, model: "multilingual", maxTokens: 8192, headMaxTokens: 192 },
  }
  expect(parseConfig(JSON.stringify(config))).toMatchObject({
    succeeded: false,
    problems: expect.arrayContaining([expect.stringContaining("decisionModel.endpoint")]),
  })
})

test("decision validation reports endpoint, token constraints, model and unknown fields together", () => {
  const text = JSON.stringify({
    ...aConfig(),
    decisionModel: {
      provider: "laya",
      endpoint: "https://remote/v1/systemone",
      model: "other",
      maxTokens: 9000,
      headMaxTokens: 10000,
      apiKey: "discard-secret",
    },
  })
  const result = parseConfig(text)
  expect(result.succeeded).toBe(false)
  if (result.succeeded) throw new Error("invalid decision settings accepted")
  for (const field of ["endpoint", "model", "maxTokens", "headMaxTokens", "apiKey"]) {
    expect(result.problems.join(" ")).toContain(`decisionModel.${field}`)
  }
  expect(JSON.stringify(inspectConfigForRepair(text))).not.toContain("discard-secret")
})

test.each([
  { provider: "typesafe", model: "other" },
  { provider: "typesafe", model: "jev-latest", endpoint: "http://127.0.0.1/v1/systemone" },
  { provider: "typesafe", model: "jev-latest", apiKey: "secret" },
])("refuses unsupported or extra Jev settings %j", (decisionModel) => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), decisionModel })).succeeded).toBe(false)
})

test("missing decision provider does not discard independently valid Laya siblings or label them unknown", () => {
  const text = JSON.stringify({
    ...aConfig(),
    decisionModel: {
      model: "multilingual",
      endpoint: "https://127.0.0.1:9000/v1/systemone",
      maxTokens: 4000,
      headMaxTokens: 123,
      extra: "discard",
    },
  })
  const draft = inspectConfigForRepair(text)
  expect(draft.decisionModel).toEqual({
    provider: "laya",
    model: "multilingual",
    endpoint: "https://127.0.0.1:9000/v1/systemone",
    maxTokens: 4000,
    headMaxTokens: 123,
  })
  expect(draft.problems).toEqual([
    "decisionModel.extra: not a known field",
    "decisionModel: must have required properties provider",
  ])
})

test("repair keeps resource siblings but cannot silently accept contradictory token limits", () => {
  const config = {
    ...aConfig(),
    embeddings: { provider: "openai", model: "wrong" },
    decisionModel: {
      provider: "laya",
      endpoint: "http://127.0.0.1:9000/v1/systemone",
      model: "multilingual",
      maxTokens: 100,
      headMaxTokens: 192,
    },
  }
  const draft = inspectConfigForRepair(JSON.stringify(config))
  expect(draft.embeddings).toEqual({ provider: "openai", model: "text-embedding-3-small" })
  expect(draft.decisionModel).toEqual(config.decisionModel)
  expect(draft.problems.join(" ")).toContain("decisionModel.headMaxTokens")
})
