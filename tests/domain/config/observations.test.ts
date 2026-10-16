import { expect, test } from "vitest"

import { parseConfig, readConfigFields } from "#src/domain"
import { aConfig } from "#test-helpers"

test("the decision provider laya selects its own required fields", () => {
  const config = aConfig()
  const decisionModel = { provider: "laya", model: "multilingual" }
  expect(parseConfig(JSON.stringify({ ...config, decisionModel }))).toEqual({
    succeeded: false,
    problems: [
      "decisionModel: must have required properties endpoint",
      "decisionModel: must have required properties maxTokens",
      "decisionModel: must have required properties headMaxTokens",
    ],
  })
})

test("an unrecognised or non-string decision provider falls back to the generic required fields", () => {
  const config = aConfig()
  for (const provider of ["other", 5]) {
    const result = parseConfig(JSON.stringify({ ...config, decisionModel: { provider } }))
    expect(result).toMatchObject({ succeeded: false })
    expect(JSON.stringify(result)).toContain("decisionModel: must have required properties model")
    expect(JSON.stringify(result)).not.toContain("endpoint")
  }
})

test("the decision provider typesafe retains no laya-only field and laya drops an unsafe endpoint", () => {
  const config = aConfig()
  const jev = {
    provider: "typesafe",
    model: "jev-latest",
    endpoint: "http://127.0.0.1:8000/v1/systemone",
    maxTokens: 5,
  }
  expect(readConfigFields(JSON.stringify({ ...config, decisionModel: jev })).decisionModel).toEqual({
    provider: "typesafe",
    model: "jev-latest",
  })
  const unsafe = { ...config.decisionModel, endpoint: "http://evil/v1/systemone" }
  expect(readConfigFields(JSON.stringify({ ...config, decisionModel: unsafe })).decisionModel).toEqual({
    provider: "laya",
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
  })
})

test("projects are observed per index and an absent one leaves an empty slot", () => {
  const config = { ...aConfig(), projects: [{ name: "a" }, 7, { folder: "D:/b", vault: "C:/b" }] }
  expect(readConfigFields(JSON.stringify(config)).projects).toEqual([
    { name: "a" },
    {},
    { folder: "D:/b", vault: "C:/b" },
  ])
})

test("a projects value that is not an array yields no project slots", () => {
  expect(readConfigFields(JSON.stringify({ ...aConfig(), projects: {} })).projects).toEqual([])
})
