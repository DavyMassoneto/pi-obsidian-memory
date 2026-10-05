import { expect, test } from "vitest"

import { parseConfig } from "#/domain"
import { aConfig } from "#test-helpers"

function withLimits(limits: object): string {
  return JSON.stringify({ ...aConfig(), limits })
}

test("reads a complete config", () => {
  expect(parseConfig(JSON.stringify(aConfig()))).toEqual({ succeeded: true, output: aConfig() })
})

test("accepts a config with no projects yet", () => {
  const config = { ...aConfig(), projects: [] }

  expect(parseConfig(JSON.stringify(config))).toEqual({ succeeded: true, output: config })
})

test("refuses text that is not JSON", () => {
  expect(parseConfig("{ global: ")).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^config: not valid JSON/)],
  })
})

test("refuses a config without limits, since every value must be written in the file", () => {
  const { limits: _limits, ...withoutLimits } = aConfig()

  expect(parseConfig(JSON.stringify(withoutLimits))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^config: .*limits/)],
  })
})

test("names a nested field with its full path", () => {
  expect(parseConfig(withLimits({ maxBodyChars: "mil", maxStatementChars: 100 }))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^limits\.maxBodyChars: /)],
  })
})

test.each([
  ["zero", 0],
  ["negative", -5],
  ["fractional", 10.5],
])("refuses a %s limit", (_case, value) => {
  expect(parseConfig(withLimits({ maxBodyChars: value, maxStatementChars: 100 }))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^limits\.maxBodyChars: /)],
  })
})

test("refuses an empty vault path", () => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), global: { vault: "" } }))).toEqual({
    succeeded: false,
    problems: [expect.stringMatching(/^global\.vault: /)],
  })
})

test("refuses a field that is not in the format", () => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), theme: "dark" }))).toEqual({
    succeeded: false,
    problems: ["theme: not a known field"],
  })
})

test("names an unknown nested field with its full path", () => {
  expect(parseConfig(withLimits({ maxBodyChars: 1000, maxStatementChars: 100, maxTags: 3 }))).toEqual({
    succeeded: false,
    problems: ["limits.maxTags: not a known field"],
  })
})

test("lists every problem at once", () => {
  const config = { ...aConfig(), global: { vault: "" }, limits: { maxBodyChars: 0, maxStatementChars: 100 } }
  const result = parseConfig(JSON.stringify(config))

  expect(result).toEqual({
    succeeded: false,
    problems: expect.arrayContaining([expect.stringMatching(/^global\.vault: /), expect.stringMatching(/^limits\./)]),
  })
})
