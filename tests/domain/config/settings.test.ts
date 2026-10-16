import { expect, test } from "vitest"

import { inspectConfigForRepair, prepareSetupDefaults, proposeSetup } from "#src/domain"
import { productSettings } from "#test-helpers"

test("setup alone can use the explicitly supplied model and null leaves both models unresolved", () => {
  const selected = { provider: "chosen-provider", id: "chosen-model" }
  const defaults = prepareSetupDefaults(selected)
  expect(defaults).toEqual({
    ...productSettings(),
    capture: { model: selected, when: "after-each-turn" },
    memoryAgent: { model: selected },
    global: {},
    projects: [],
    replacementRequired: false,
    problems: [],
  })
  expect(prepareSetupDefaults(null).capture.model).toEqual({})
  expect(prepareSetupDefaults(null).memoryAgent.model).toEqual({})
  expect(inspectConfigForRepair("{}").capture.model).toEqual({})
  expect(proposeSetup({ config: prepareSetupDefaults(null), vault: "C:/new" }).succeeded).toBe(false)
  selected.id = "changed-after-preparation"
  expect(defaults.capture.model.id).toBe("chosen-model")
})
