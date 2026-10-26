import { describe, expect, test } from "vitest"

import type { SettingChange } from "#src/domain"
import { aConfig, changed, changeSetting } from "#test-helpers"

describe("changeSetting on the consolidator", () => {
  test("changing the consolidator model, thinking or numbers writes only that", () => {
    const config = aConfig()
    const model = { provider: "other", id: "model-x" }

    expect(changed(config, { kind: "consolidatorModel", model })).toEqual({
      ...config,
      consolidator: { ...config.consolidator, model },
    })
    for (const value of ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const) {
      expect(changed(config, { kind: "thinking", role: "consolidator", value })).toEqual({
        ...config,
        consolidator: { ...config.consolidator, thinking: value },
      })
    }
    for (const name of ["atPoolTokens", "poolTargetTokens", "journeyTokens"] as const) {
      expect(changed(config, { kind: "consolidatorCount", name, value: 7 })).toEqual({
        ...config,
        consolidator: { ...config.consolidator, [name]: 7 },
      })
    }
  })

  test("changing the observer thinking leaves the consolidator alone", () => {
    const config = aConfig()

    expect(changed(config, { kind: "thinking", role: "observer", value: "high" }).consolidator).toEqual(
      config.consolidator,
    )
  })

  test.each([
    [
      "a pool trigger of 0",
      { kind: "consolidatorCount", name: "atPoolTokens", value: 0 },
      "consolidator.atPoolTokens: must be >= 1",
    ],
    [
      "a journey size of 0",
      { kind: "consolidatorCount", name: "journeyTokens", value: 0 },
      "consolidator.journeyTokens: must be >= 1",
    ],
  ] satisfies [string, SettingChange, string][])("refuses %s and names the problem", (_case, change, problem) => {
    expect(changeSetting(aConfig(), change)).toEqual({ succeeded: false, problems: [problem] })
  })
})
