import { describe, expect, test } from "vitest"

import { readConfigFields } from "#src/domain"
import { aConfig, inspectConfigForRepair, legacyCaptureText, parseConfig, upgradedCapture } from "#test-helpers"

describe.each([
  { when: "after-each-turn", cadence: {} },
  { when: "at-session-end", cadence: { reviewEnabled: false, flushOnCompact: false } },
  { when: "on-compaction", cadence: { reviewEnabled: false, flushOnShutdown: false } },
] as const)("a config that still says capture.when is $when", ({ when, cadence }) => {
  const text = legacyCaptureText(when, {})

  test("is read as the new capture settings, with the numbers at their defaults", () => {
    expect(parseConfig(text)).toEqual({
      succeeded: true,
      output: { ...aConfig(), capture: upgradedCapture(cadence) },
    })
  })

  test("is repaired and read field by field the same way", () => {
    expect(inspectConfigForRepair(text).capture).toEqual(upgradedCapture(cadence))
    expect(readConfigFields(text).capture).toEqual(upgradedCapture(cadence))
  })
})

test("a capture.when that is not one of the old choices is still refused", () => {
  const result = parseConfig(legacyCaptureText("never", {}))
  if (result.succeeded) throw new Error("unknown capture.when accepted")
  expect(result.problems).toContain("capture.when: not a known field")
})

test("explicit new settings next to an old capture.when win over the mapping", () => {
  const text = legacyCaptureText("at-session-end", { reviewEnabled: true, nudgeInterval: 4 })
  expect(parseConfig(text)).toEqual({
    succeeded: true,
    output: {
      ...aConfig(),
      capture: upgradedCapture({ reviewEnabled: true, flushOnCompact: false, nudgeInterval: 4 }),
    },
  })
})
