import { expect, test } from "vitest"

import { settingLines } from "#src/pi"
import { aConfig, lineLabels } from "#test-helpers"

test("the screen lists the observer model, thinking, chunk, concurrency, threshold, tail and map lines with their values, then the memory agent and the rest", () => {
  expect(settingLines(aConfig()).map((line) => line.label.split(":")[0])).toEqual([
    "Observer model",
    "Observer thinking",
    "Observe every",
    "Observers at a time",
    "Compact at",
    "Verbatim tail",
    "Memory map",
    "Memory agent model",
    "Decision model",
    "Gate cutoff",
    "Relevance cutoff",
    "Embeddings",
    "Context budget",
    "Max note body",
    "Max statement",
    "Max notes per folder",
    "Global vault",
    "Projects",
  ])
})

test("each line shows its current value", () => {
  const config = aConfig()

  expect(lineLabels(config)).toContain("Context budget: 12000 characters")
  expect(lineLabels(config)).toContain("Max notes per folder: 20")
  expect(lineLabels(config)).toContain("Projects: 2")
  expect(lineLabels(config)).toContain("Observer model: test-chat/selected-chat")
  expect(lineLabels(config)).toContain("Observer thinking: low")
  expect(lineLabels(config)).toContain("Observe every: 10000 tokens")
  expect(lineLabels(config)).toContain("Observers at a time: 4")
  expect(lineLabels(config)).toContain("Compact at: 150000 context tokens")
  expect(lineLabels(config)).toContain("Verbatim tail: 20000 tokens")
  expect(lineLabels(config)).toContain("Memory map: 2000 tokens")
})

test("the cutoffs read 'not set' for Laya, show TypeSafe's values for Jev and 'set' when the config has one", () => {
  const laya = aConfig()
  const jev = { ...aConfig(), decisionModel: { provider: "typesafe", model: "jev-latest" } } as const
  const set = { ...aConfig(), decisionModel: { ...jev.decisionModel, relevanceThreshold: 0.7 } } as const

  expect(lineLabels(laya)).toContain("Gate cutoff: not set")
  expect(lineLabels(jev)).toContain("Gate cutoff: 0.5 (TypeSafe starting value)")
  expect(lineLabels(set)).toContain("Relevance cutoff: 0.7 (set)")
  expect(lineLabels(set)).toContain("Gate cutoff: 0.5 (TypeSafe starting value)")
})
