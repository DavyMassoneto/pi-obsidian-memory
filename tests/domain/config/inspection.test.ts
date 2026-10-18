import { expect, test } from "vitest"

import { aConfig, parseConfig } from "#test-helpers"

test("text that is not JSON is refused as a single problem carrying the parser message", () => {
  const result = parseConfig("{")
  if (result.succeeded) throw new Error("invalid JSON accepted")
  expect(result.problems).toHaveLength(1)
  expect(result.problems[0]).toMatch(/^config: not valid JSON \(.+\)$/)
})

test("a valid document returns the parsed config unchanged", () => {
  expect(parseConfig(JSON.stringify(aConfig()))).toEqual({ succeeded: true, output: aConfig() })
})

test("projects that is not an array is refused and no project is inspected", () => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), projects: {} }))).toEqual({
    succeeded: false,
    problems: ["projects: must be array"],
  })
})

test.each([
  { maxTokens: 100, headMaxTokens: 100, refused: true },
  { maxTokens: 100, headMaxTokens: 101, refused: true },
  { maxTokens: 100, headMaxTokens: 99, refused: false },
])(
  "head tokens $headMaxTokens against max tokens $maxTokens is refused: $refused",
  ({ maxTokens, headMaxTokens, refused }) => {
    const config = aConfig()
    const result = parseConfig(
      JSON.stringify({ ...config, decisionModel: { ...config.decisionModel, maxTokens, headMaxTokens } }),
    )
    if (refused) {
      expect(result).toEqual({
        succeeded: false,
        problems: ["decisionModel.headMaxTokens: must be less than decisionModel.maxTokens"],
      })
    } else expect(result.succeeded).toBe(true)
  },
)

test("a token order check is skipped when either value is not a number", () => {
  const config = aConfig()
  const result = parseConfig(
    JSON.stringify({ ...config, decisionModel: { ...config.decisionModel, maxTokens: "x", headMaxTokens: 100 } }),
  )
  expect(result).toEqual({ succeeded: false, problems: ["decisionModel.maxTokens: must be integer"] })
})

test("a token order check is skipped when max tokens is a numeric string", () => {
  const config = aConfig()
  const decisionModel = { ...config.decisionModel, maxTokens: "50", headMaxTokens: 100 }
  expect(parseConfig(JSON.stringify({ ...config, decisionModel }))).toEqual({
    succeeded: false,
    problems: ["decisionModel.maxTokens: must be integer"],
  })
})
