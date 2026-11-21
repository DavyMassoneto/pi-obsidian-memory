import { describe, expect, test } from "vitest"

import { readConfigFields, upgradeLegacyConfig } from "#src/domain"
import { aConfig, inspectConfigForRepair, legacyConfigText, parseConfig } from "#test-helpers"

const model = aConfig().observer.model

const sixKeys = {
  nudgeInterval: 10,
  nudgeToolCalls: 15,
  flushMinTurns: 6,
  reviewEnabled: true,
  flushOnCompact: true,
  flushOnShutdown: true,
}

describe("upgradeLegacyConfig", () => {
  test("a config with the six capture keys and a model reads as an observer with that model and the default observer and compaction settings, without capture", () => {
    const text = legacyConfigText({ model, ...sixKeys })

    expect(parseConfig(text)).toEqual({ succeeded: true, output: aConfig() })
    expect(JSON.parse(upgradeLegacyConfig(text))).not.toHaveProperty("capture")
  })

  test("a config with capture.when reads the same way", () => {
    for (const when of ["after-each-turn", "at-session-end", "on-compaction"]) {
      expect(parseConfig(legacyConfigText({ model, when }))).toEqual({ succeeded: true, output: aConfig() })
    }
  })

  test("a capture without a valid model leaves the observer and consolidator models missing, and reading names them", () => {
    for (const capture of [{ ...sixKeys }, { model: { provider: "", id: "x" }, ...sixKeys }, { model: 5 }]) {
      const text = legacyConfigText(capture)
      const result = parseConfig(text)

      if (result.succeeded) throw new Error("a capture without a model was accepted")
      expect(result.problems).toEqual([
        "observer: must have required properties model",
        "consolidator: must have required properties model",
      ])
      expect(inspectConfigForRepair(text).observer).toEqual({ ...aConfig().observer, model: {} })
      expect(inspectConfigForRepair(text).consolidator).toEqual({ ...aConfig().consolidator, model: {} })
    }
  })

  test("a compaction group already in the file is kept", () => {
    const compaction = { atContextTokens: 90000, tailTokens: 7000, mapTokens: 1000 }
    const text = JSON.stringify({ ...JSON.parse(legacyConfigText({ model, ...sixKeys })), compaction })

    expect(parseConfig(text)).toEqual({ succeeded: true, output: { ...aConfig(), compaction } })
  })

  test("a config that already has an observer is returned unchanged", () => {
    const text = JSON.stringify({ ...aConfig(), capture: { model, ...sixKeys } })

    expect(upgradeLegacyConfig(text)).toBe(text)
    expect(upgradeLegacyConfig(JSON.stringify(aConfig()))).toBe(JSON.stringify(aConfig()))
  })

  test("a config with an observer and no consolidator gets one with the observer's model, thinking medium and the default numbers", () => {
    const { consolidator: _consolidator, ...without } = aConfig()
    const observer = { ...aConfig().observer, model: { provider: "other", id: "other-model" } }
    const text = JSON.stringify({ ...without, observer })

    expect(JSON.parse(upgradeLegacyConfig(text)).consolidator).toEqual({
      model: observer.model,
      thinking: "medium",
      atPoolTokens: 15000,
      poolTargetTokens: 10000,
      journeyTokens: 1000,
    })
    expect(parseConfig(text)).toEqual({
      succeeded: true,
      output: { ...aConfig(), observer, consolidator: { ...aConfig().consolidator, model: observer.model } },
    })
  })

  test("an observer without a valid model gives a consolidator without a model", () => {
    const { consolidator: _consolidator, ...without } = aConfig()
    const text = JSON.stringify({ ...without, observer: { ...aConfig().observer, model: 5 } })

    expect(JSON.parse(upgradeLegacyConfig(text)).consolidator).toEqual({
      thinking: "medium",
      atPoolTokens: 15000,
      poolTargetTokens: 10000,
      journeyTokens: 1000,
    })
  })

  test("an old capture config gets an observer and a consolidator from the capture model", () => {
    const upgraded = JSON.parse(upgradeLegacyConfig(legacyConfigText({ model, ...sixKeys })))

    expect(upgraded.observer).toEqual(aConfig().observer)
    expect(upgraded.consolidator).toEqual(aConfig().consolidator)
  })

  test("a config whose observer is not an object gets no consolidator", () => {
    const { consolidator: _consolidator, ...without } = aConfig()
    const text = JSON.stringify({ ...without, observer: 5 })

    expect(upgradeLegacyConfig(text)).toBe(text)
  })

  test("text that is not JSON is returned as it is", () => {
    for (const text of ["{", "", "[]", "5", "null"]) expect(upgradeLegacyConfig(text)).toBe(text)
  })

  test("the old capture config is repaired and read field by field as an observer", () => {
    const text = legacyConfigText({ model, ...sixKeys })

    expect(inspectConfigForRepair(text).observer).toEqual(aConfig().observer)
    expect(readConfigFields(text).observer).toEqual(aConfig().observer)
    expect(readConfigFields(text).consolidator).toEqual(aConfig().consolidator)
  })
})
