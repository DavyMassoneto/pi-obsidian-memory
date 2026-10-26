import { expect, test } from "vitest"

import { prepareSetupDefaults } from "#src/domain"
import { inspectConfigForRepair, productSettings, proposeSetup } from "#test-helpers"

test("setup alone can use the explicitly supplied model and null leaves both models unresolved", () => {
  const selected = { provider: "chosen-provider", id: "chosen-model" }
  const defaults = prepareSetupDefaults(selected)
  expect(defaults).toEqual({
    ...productSettings(),
    decisionModel: { provider: "typesafe", model: "jev-latest" },
    observer: { ...productSettings().observer, model: selected },
    consolidator: { ...productSettings().consolidator, model: selected },
    memoryAgent: { model: selected },
    global: {},
    projects: [],
    replacementRequired: false,
    problems: [],
  })
  expect(prepareSetupDefaults(null).observer.model).toEqual({})
  expect(prepareSetupDefaults(null).memoryAgent.model).toEqual({})
  expect(inspectConfigForRepair("{}").observer.model).toEqual({})
  expect(proposeSetup({ config: prepareSetupDefaults(null), vault: "C:/new" }).succeeded).toBe(false)
  selected.id = "changed-after-preparation"
  expect(defaults.observer.model.id).toBe("chosen-model")
})

test("setup defaults fill the consolidator model from the selected model", () => {
  const selected = { provider: "chosen-provider", id: "chosen-model" }

  expect(prepareSetupDefaults(selected).consolidator).toEqual({
    model: selected,
    thinking: "medium",
    atPoolTokens: 15000,
    poolTargetTokens: 10000,
    journeyTokens: 1000,
  })
  expect(prepareSetupDefaults(null).consolidator.model).toEqual({})
})

test("setup defaults fill the observer model from the selected model and the observer and compaction numbers from OM's defaults", () => {
  const selected = { provider: "chosen-provider", id: "chosen-model" }
  const defaults = prepareSetupDefaults(selected)

  expect(defaults.observer).toEqual({ model: selected, thinking: "low", chunkTokens: 10000, concurrency: 4 })
  expect(defaults.compaction).toEqual({ atContextTokens: 150000, tailTokens: 20000, mapTokens: 2000 })
  expect(prepareSetupDefaults(null).observer).toEqual({
    model: {},
    thinking: "low",
    chunkTokens: 10000,
    concurrency: 4,
  })
})
