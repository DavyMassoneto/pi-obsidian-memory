import { expect, test } from "vitest"

import { readConfigFields } from "#/domain"

test.each(["null", "false", "42", "[]", '"text"'])("malformed root %s retains no fields", (text) => {
  expect(readConfigFields(text)).toEqual({ global: {}, projects: [], limits: {} })
})

test("extracts only exact supported valid fields, preserving entry positions for correction", () => {
  const text = JSON.stringify({
    global: { vault: "relative" },
    limits: { maxBodyChars: 70, maxStatementChars: -1 },
    projects: [null, { name: "app", folder: "D:/app", vault: "C:/vault", extra: 5 }, { name: "", folder: 5 }],
  })
  expect(readConfigFields(text)).toEqual({
    global: {},
    projects: [{}, { name: "app", folder: "D:/app", vault: "C:/vault" }, {}],
    limits: { maxBodyChars: 70 },
  })
})
