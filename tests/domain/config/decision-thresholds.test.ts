import { describe, expect, test } from "vitest"

import { inspectConfigForRepair, parseConfig, readConfigFields } from "#src/domain"
import { aConfig, configTextWithDecisionModel } from "#test-helpers"

const jev = { provider: "typesafe", model: "jev-latest" }

describe.each([
  ["laya", aConfig().decisionModel],
  ["typesafe", jev],
])("decision thresholds with %s", (_provider, base) => {
  test.each([0, 0.3, 1])("accepts gateThreshold and relevanceThreshold %s", (value) => {
    const decisionModel = { ...base, gateThreshold: value, relevanceThreshold: value }
    expect(parseConfig(configTextWithDecisionModel(decisionModel))).toMatchObject({ succeeded: true })
  })

  test("accepts a config without thresholds", () => {
    expect(parseConfig(configTextWithDecisionModel(base))).toMatchObject({ succeeded: true })
  })

  test.each([
    ["gateThreshold", -0.1, "must be >= 0"],
    ["gateThreshold", 1.1, "must be <= 1"],
    ["relevanceThreshold", -0.1, "must be >= 0"],
    ["relevanceThreshold", 1.1, "must be <= 1"],
    ["gateThreshold", "0.5", "must be number"],
    ["relevanceThreshold", null, "must be number"],
  ])("refuses %s = %j", (field, value, problem) => {
    expect(parseConfig(configTextWithDecisionModel({ ...base, [field]: value }))).toEqual({
      succeeded: false,
      problems: [`decisionModel.${field}: ${problem}`],
    })
  })

  test("keeps valid thresholds when reading fields and drops invalid ones", () => {
    const valid = readConfigFields(
      configTextWithDecisionModel({ ...base, gateThreshold: 0.4, relevanceThreshold: 0.6 }),
    )
    expect(valid.decisionModel).toMatchObject({ gateThreshold: 0.4, relevanceThreshold: 0.6 })
    const invalid = readConfigFields(
      configTextWithDecisionModel({ ...base, gateThreshold: 2, relevanceThreshold: "x" }),
    )
    expect(invalid.decisionModel).not.toHaveProperty("gateThreshold")
    expect(invalid.decisionModel).not.toHaveProperty("relevanceThreshold")
  })

  test("repair keeps valid thresholds and invents none", () => {
    const kept = inspectConfigForRepair(configTextWithDecisionModel({ ...base, gateThreshold: 0.4 }))
    expect(kept.decisionModel).toMatchObject({ gateThreshold: 0.4 })
    expect(kept.decisionModel).not.toHaveProperty("relevanceThreshold")
  })
})
