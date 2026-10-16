import { expect, test } from "vitest"

import { readConfigFields } from "#src/domain"
import { emptyConfigFields } from "#test-helpers"

test.each(["null", "false", "42", "[]", '"text"'])("malformed root %s retains no fields", (text) => {
  expect(readConfigFields(text)).toEqual(emptyConfigFields())
})

test("validates every supported field independently across many damaged registrations", () => {
  const projects = Array.from({ length: 2000 }, (_, index) => ({
    name: `project-${index}`,
    folder: `D:/work/${index}`,
    vault: `C:/vaults/${index}`,
  }))
  const text = JSON.stringify({
    global: { vault: "C:/global", extra: true },
    limits: { maxBodyChars: "70", maxStatementChars: 90 },
    projects: [
      ...projects,
      { name: 4, folder: "D:/keep", vault: false },
      { name: "keep", folder: [], vault: "C:/keep" },
      { name: " ", folder: {}, vault: "relative" },
    ],
  })

  expect(readConfigFields(text)).toEqual({
    ...emptyConfigFields(),
    global: { vault: "C:/global" },
    limits: { maxStatementChars: 90 },
    projects: [...projects, { folder: "D:/keep" }, { name: "keep", vault: "C:/keep" }, {}],
  })
})

test("syntactically invalid JSON is not salvaged into empty fields", () => {
  expect(() => readConfigFields('{"global":')).toThrow(SyntaxError)
})

test("extracts only exact supported valid fields, preserving entry positions for correction", () => {
  const text = JSON.stringify({
    global: { vault: "relative" },
    limits: { maxBodyChars: 70, maxStatementChars: -1 },
    projects: [null, { name: "app", folder: "D:/app", vault: "C:/vault", extra: 5 }, { name: "", folder: 5 }],
  })
  expect(readConfigFields(text)).toEqual({
    ...emptyConfigFields(),
    global: {},
    projects: [{}, { name: "app", folder: "D:/app", vault: "C:/vault" }, {}],
    limits: { maxBodyChars: 70 },
  })
})
