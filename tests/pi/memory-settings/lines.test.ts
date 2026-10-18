import { expect, test } from "vitest"

import { settingLines } from "#src/pi"
import { aConfig, lineLabels } from "#test-helpers"

test("the lines are in a fixed order, one per setting, then the global vault and the projects", () => {
  expect(settingLines(aConfig()).map((line) => line.label.split(":")[0])).toEqual([
    "Capture model",
    "Review during the session",
    "Review every",
    "Review after tool calls",
    "Flush at compaction",
    "Flush at session end",
    "Flush minimum user messages",
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
  expect(lineLabels(config)).toContain("Review during the session: on")
  expect(lineLabels(config)).toContain("Review every: 10 turns")
  expect(lineLabels(config)).toContain("Review after tool calls: 15")
  expect(lineLabels(config)).toContain("Flush at compaction: on")
  expect(lineLabels(config)).toContain("Flush at session end: on")
  expect(lineLabels(config)).toContain("Flush minimum user messages: 6")
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
