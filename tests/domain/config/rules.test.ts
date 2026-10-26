import { expect, test } from "vitest"

import { aConfig, parseConfig } from "#test-helpers"

test.each([
  {
    fields: { observer: {} },
    problems: [
      "observer: must have required properties model",
      "observer: must have required properties thinking",
      "observer: must have required properties chunkTokens",
      "observer: must have required properties concurrency",
    ],
  },
  {
    fields: { compaction: {} },
    problems: [
      "compaction: must have required properties atContextTokens",
      "compaction: must have required properties tailTokens",
      "compaction: must have required properties mapTokens",
    ],
  },
  { fields: { memoryAgent: {} }, problems: ["memoryAgent: must have required properties model"] },
  {
    fields: { memoryAgent: { model: {} } },
    problems: [
      "memoryAgent.model: must have required properties provider",
      "memoryAgent.model: must have required properties id",
    ],
  },
  { fields: { context: {} }, problems: ["context: must have required properties budgetChars"] },
  { fields: { embeddings: { provider: "google" } }, problems: ["embeddings: must have required properties model"] },
  {
    fields: { decisionModel: { provider: "typesafe" } },
    problems: ["decisionModel: must have required properties model"],
  },
  {
    fields: { decisionModel: { provider: "laya" } },
    problems: [
      "decisionModel: must have required properties endpoint",
      "decisionModel: must have required properties model",
      "decisionModel: must have required properties maxTokens",
      "decisionModel: must have required properties headMaxTokens",
    ],
  },
])("names every required field in the selected shape: $fields", ({ fields, problems }) => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), ...fields }))).toEqual({ succeeded: false, problems })
})

test("a wrong observer model shape is reported on its own field", () => {
  const config = aConfig()
  const observer = (model: object) => ({ ...config.observer, model })

  expect(parseConfig(JSON.stringify({ ...config, observer: observer({ provider: "p" }) }))).toEqual({
    succeeded: false,
    problems: ["observer.model: must have required properties id"],
  })
  expect(parseConfig(JSON.stringify({ ...config, observer: observer({ provider: "p", id: " " }) }))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^observer\.model\.id: /)],
  })
  expect(parseConfig(JSON.stringify({ ...config, observer: observer({ provider: "p", id: "i", extra: 1 }) }))).toEqual({
    succeeded: false,
    problems: ["observer.model.extra: not a known field"],
  })
})

test("unknown keys are refused at each product setting level without discarding later diagnostics", () => {
  const config = aConfig()
  const result = parseConfig(
    JSON.stringify({
      ...config,
      observer: { ...config.observer, extra: "discard", model: { ...config.observer.model, extra: "discard" } },
      memoryAgent: {
        ...config.memoryAgent,
        extra: "discard",
        model: { ...config.memoryAgent.model, extra: "discard" },
      },
      context: { ...config.context, extra: "discard" },
      limits: { ...config.limits, extra: "discard" },
      embeddings: { ...config.embeddings, extra: "discard" },
      decisionModel: { ...config.decisionModel, extra: "discard" },
    }),
  )
  expect(result).toEqual({
    succeeded: false,
    problems: [
      "limits.extra: not a known field",
      "observer.extra: not a known field",
      "observer.model.extra: not a known field",
      "memoryAgent.extra: not a known field",
      "memoryAgent.model.extra: not a known field",
      "context.extra: not a known field",
      "embeddings.extra: not a known field",
      "decisionModel.extra: not a known field",
    ],
  })
})
