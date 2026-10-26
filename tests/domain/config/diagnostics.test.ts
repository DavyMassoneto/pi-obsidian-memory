import { expect, test } from "vitest"

import { aConfig, parseConfig } from "#test-helpers"

test("an empty object names each missing root field once, in schema order, under the name config", () => {
  expect(parseConfig("{}")).toEqual({
    succeeded: false,
    problems: [
      "config: must have required properties global",
      "config: must have required properties projects",
      "config: must have required properties limits",
      "config: must have required properties capture",
      "config: must have required properties observer",
      "config: must have required properties compaction",
      "config: must have required properties memoryAgent",
      "config: must have required properties context",
      "config: must have required properties embeddings",
      "config: must have required properties decisionModel",
    ],
  })
})

test("a wrong value is named by its dotted path with the schema message and nothing else", () => {
  const config = aConfig()
  const text = JSON.stringify({ ...config, limits: { ...config.limits, maxBodyChars: 0 } })
  expect(parseConfig(text)).toEqual({ succeeded: false, problems: ["limits.maxBodyChars: must be >= 1"] })
})

test("a non-object where an object is required is reported once at its own path", () => {
  const config = aConfig()
  expect(parseConfig(JSON.stringify({ ...config, capture: { model: 5, when: "on-compaction" } }))).toEqual({
    succeeded: false,
    problems: ["capture.model: must be object"],
  })
  expect(parseConfig(JSON.stringify({ ...config, global: 5 }))).toEqual({
    succeeded: false,
    problems: ["global: must be object"],
  })
  expect(parseConfig(JSON.stringify({ ...config, projects: [5] }))).toEqual({
    succeeded: false,
    problems: ["projects.0: must be object"],
  })
})
