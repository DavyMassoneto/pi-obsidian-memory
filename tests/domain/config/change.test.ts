import { describe, expect, test } from "vitest"

import { parseSettingNumber, type SettingChange } from "#src/domain"
import { aConfig, changed, changeSetting, jevConfig, jevDecision } from "#test-helpers"

describe("changeSetting", () => {
  test("changes only the chosen model and keeps everything else", () => {
    const config = aConfig()
    const model = { provider: "other", id: "model-x" }

    expect(changed(config, { kind: "captureModel", model })).toEqual({
      ...config,
      capture: { ...config.capture, model },
    })
    expect(changed(config, { kind: "agentModel", model })).toEqual({ ...config, memoryAgent: { model } })
  })

  test("changes each capture count and switch, the embeddings provider, the context budget and each limit", () => {
    const config = aConfig()
    const embeddings = { provider: "google", model: "gemini-embedding-001" } as const

    for (const name of ["nudgeInterval", "nudgeToolCalls", "flushMinTurns"] as const) {
      expect(changed(config, { kind: "captureCount", name, value: 7 }).capture).toEqual({
        ...config.capture,
        [name]: 7,
      })
    }
    for (const name of ["reviewEnabled", "flushOnCompact", "flushOnShutdown"] as const) {
      expect(changed(config, { kind: "captureSwitch", name, value: false }).capture).toEqual({
        ...config.capture,
        [name]: false,
      })
    }
    expect(changed(config, { kind: "embeddings", embeddings }).embeddings).toEqual(embeddings)
    expect(changed(config, { kind: "budgetChars", value: 500 }).context).toEqual({ budgetChars: 500 })
    for (const name of ["maxBodyChars", "maxStatementChars", "maxNotesPerFolder"] as const) {
      expect(changed(config, { kind: "limit", name, value: 7 }).limits).toEqual({ ...config.limits, [name]: 7 })
    }
  })

  test("sets and clears a threshold on either provider", () => {
    for (const config of [aConfig(), jevConfig({})]) {
      const gated = changed(config, { kind: "gateThreshold", value: 0.4 })
      expect(gated.decisionModel).toMatchObject({ gateThreshold: 0.4 })
      const both = changed(gated, { kind: "relevanceThreshold", value: 0 })
      expect(both.decisionModel).toMatchObject({ gateThreshold: 0.4, relevanceThreshold: 0 })
      const cleared = changed(both, { kind: "gateThreshold", value: null })
      expect(cleared.decisionModel).not.toHaveProperty("gateThreshold")
      expect(cleared.decisionModel).toMatchObject({ relevanceThreshold: 0 })
    }
  })

  test("switching from Laya to Jev drops the Laya fields and clears both thresholds", () => {
    const laya = changed(aConfig(), { kind: "gateThreshold", value: 0.3 })

    expect(changed(laya, { kind: "decision", provider: "typesafe" }).decisionModel).toStrictEqual(jevDecision)
  })

  test("switching from Jev to Laya starts from the Laya defaults, with the endpoint and no thresholds", () => {
    const endpoint = "http://127.0.0.1:9000/v1/systemone"
    const result = changed(jevConfig({ gateThreshold: 0.6, relevanceThreshold: 0.7 }), {
      kind: "decision",
      provider: "laya",
      endpoint,
    })

    expect(result.decisionModel).toStrictEqual({
      provider: "laya",
      endpoint,
      model: "multilingual",
      maxTokens: 8192,
      headMaxTokens: 192,
    })
  })

  test("keeping the provider keeps the thresholds: a new Laya endpoint keeps token limits, Jev stays as it is", () => {
    const laya = changed(aConfig(), { kind: "relevanceThreshold", value: 0.2 })
    const endpoint = "http://127.0.0.1:9001/v1/systemone"

    expect(changed(laya, { kind: "decision", provider: "laya", endpoint }).decisionModel).toStrictEqual({
      ...laya.decisionModel,
      endpoint,
    })
    const jev = jevConfig({ gateThreshold: 0.5 })
    expect(changed(jev, { kind: "decision", provider: "typesafe" }).decisionModel).toStrictEqual(jev.decisionModel)
  })

  test("repoints a project vault and removes a project, leaving the others", () => {
    const config = aConfig()
    const vault = "C:/vaults/loja-new"

    expect(changed(config, { kind: "projectVault", name: "loja", vault }).projects).toEqual([
      { ...config.projects[0], vault },
      config.projects[1],
    ])
    expect(changed(config, { kind: "removeProject", name: "loja" }).projects).toEqual([config.projects[1]])
    expect(changed(config, { kind: "removeProject", name: "loja-admin" }).projects).toEqual([config.projects[0]])
  })

  test("does not change the config it was given", () => {
    const config = aConfig()
    const snapshot = structuredClone(config)
    changeSetting(config, { kind: "decision", provider: "typesafe" })
    changeSetting(config, { kind: "removeProject", name: "loja" })

    expect(config).toEqual(snapshot)
  })

  test.each([
    ["a threshold above 1", { kind: "gateThreshold", value: 1.5 }, "decisionModel.gateThreshold: must be <= 1"],
    [
      "a negative threshold",
      { kind: "relevanceThreshold", value: -0.1 },
      "decisionModel.relevanceThreshold: must be >= 0",
    ],
    ["a limit of 0", { kind: "limit", name: "maxBodyChars", value: 0 }, "limits.maxBodyChars: must be >= 1"],
    ["a context budget of 0", { kind: "budgetChars", value: 0 }, "context.budgetChars: must be >= 1"],
    [
      "a Laya endpoint that is not loopback",
      { kind: "decision", provider: "laya", endpoint: "https://example.com/v1/systemone" },
      "decisionModel.endpoint: must be a loopback HTTP(S) /v1/systemone URL without credentials, query or fragment",
    ],
    [
      "a vault inside another vault",
      { kind: "projectVault", name: "loja", vault: "C:/vaults/loja-admin/inner" },
      "vaults must not be equal or nested",
    ],
    ["a relative project vault", { kind: "projectVault", name: "loja", vault: "relative" }, "projects.0.vault"],
  ] satisfies [string, SettingChange, string][])("refuses %s and names the problem", (_case, change, problem) => {
    const result = changeSetting(aConfig(), change)

    expect(result.succeeded).toBe(false)
    expect(JSON.stringify(result)).toContain(problem)
  })

  test.each([
    { kind: "projectVault", name: "missing", vault: "C:/vaults/x" },
    { kind: "removeProject", name: "missing" },
  ] satisfies SettingChange[])("refuses a project that is not registered: $kind", (change) => {
    expect(changeSetting(aConfig(), change)).toEqual({ succeeded: false, problems: ['No project named "missing"'] })
  })
})

describe("parseSettingNumber", () => {
  test.each([
    ["0", 0],
    ["1", 1],
    ["0.5", 0.5],
    [" 0.25 ", 0.25],
  ])("reads the threshold %j as %s", (text, value) => {
    expect(parseSettingNumber(text, "threshold")).toEqual({ succeeded: true, output: value })
  })

  test.each(["", "  ", "abc", "1.5", "2", "-0.1", "0,5", ".5", "1.", "NaN", "Infinity", "0x1", "1e-1", "0.5 0.6"])(
    "refuses the threshold %j with the reason",
    (text) => {
      expect(parseSettingNumber(text, "threshold")).toEqual({
        succeeded: false,
        problems: ["must be a number from 0 to 1, for example 0.5"],
      })
    },
  )

  test.each([
    ["1", 1],
    ["20", 20],
    [" 12000 ", 12000],
  ])("reads the count %j as %s", (text, value) => {
    expect(parseSettingNumber(text, "count")).toEqual({ succeeded: true, output: value })
  })

  test.each(["", "0", "-1", "1.5", "abc", "1e3", "0x10", "99999999999999999999", "1 2"])(
    "refuses the count %j with the reason",
    (text) => {
      expect(parseSettingNumber(text, "count")).toEqual({
        succeeded: false,
        problems: ["must be a whole number of 1 or more"],
      })
    },
  )
})
