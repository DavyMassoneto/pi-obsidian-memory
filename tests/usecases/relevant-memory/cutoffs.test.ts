import { expect, test } from "vitest"

import { cutoffsMissingNotice, decidingCutoffs, resolveCutoffs } from "#src/usecases"
import { layaModel } from "#test-helpers"

const jev = { provider: "typesafe", model: "jev-latest" } as const
const bareLaya = {
  provider: "laya",
  endpoint: "http://127.0.0.1:8000/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
} as const

test("Jev starts from TypeSafe's values", () => {
  const report = resolveCutoffs(jev)

  expect(report).toEqual({
    gate: { value: 0.5, source: "typesafe" },
    relevance: { value: 0.5, source: "typesafe" },
  })
  expect(decidingCutoffs(report)).toEqual({ gate: 0.5, relevance: 0.5 })
})

test("a value in the config overrides the provider's, one cutoff at a time", () => {
  const report = resolveCutoffs({ ...jev, gateThreshold: 0.7 })

  expect(report).toEqual({
    gate: { value: 0.7, source: "config" },
    relevance: { value: 0.5, source: "typesafe" },
  })
})

test("Laya has no value of its own, so it has none until the config sets one", () => {
  const report = resolveCutoffs(bareLaya)

  expect(report).toEqual({ gate: { value: null, source: "missing" }, relevance: { value: null, source: "missing" } })
  expect(decidingCutoffs(report)).toBeNull()
})

test("Laya with only one cutoff set still cannot decide, and the notice names the missing one and the docs", () => {
  const report = resolveCutoffs({ ...bareLaya, gateThreshold: 0.3 })

  expect(decidingCutoffs(report)).toBeNull()
  expect(cutoffsMissingNotice(report)).toContain("relevanceThreshold")
  expect(cutoffsMissingNotice(report)).not.toContain("gateThreshold")
  expect(cutoffsMissingNotice(report)).toContain("docs/decision-thresholds.md")
})

test("Laya with both cutoffs in the config decides with them", () => {
  const report = resolveCutoffs(layaModel("http://127.0.0.1:8000/v1/systemone"))

  expect(decidingCutoffs(report)).toEqual({ gate: 0.2, relevance: 0.5 })
  expect(report.gate.source).toBe("config")
})
