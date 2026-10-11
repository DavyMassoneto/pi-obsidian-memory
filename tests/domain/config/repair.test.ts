import { expect, test } from "vitest"

import { inspectConfigForRepair } from "#/domain"
import { aConfig } from "#test-helpers"

test("repair retains supported sibling values and names invalid, missing and unknown fields", () => {
  const input = { ...aConfig(), limits: { maxBodyChars: 700, extra: 5 }, surprise: true }
  const draft = inspectConfigForRepair(JSON.stringify(input))
  expect(draft).toMatchObject({
    replacementRequired: false,
    global: input.global,
    projects: input.projects,
    limits: { maxBodyChars: 700, maxStatementChars: 100 },
    problems: expect.arrayContaining([
      expect.stringContaining("maxStatementChars"),
      expect.stringContaining("extra"),
      expect.stringContaining("surprise"),
    ]),
  })
})

test("repair retains valid fields of damaged project entries without choosing a conflict winner", () => {
  const config = aConfig()
  const draft = inspectConfigForRepair(
    JSON.stringify({
      ...config,
      projects: [
        { name: "loja", folder: "D:/Projects/loja", vault: 7, extra: true },
        { name: "LOJA", folder: "D:/Projects/other", vault: "C:/other" },
      ],
    }),
  )
  expect(draft.projects).toEqual([
    { name: "loja", folder: "D:/Projects/loja" },
    { name: "LOJA", folder: "D:/Projects/other", vault: "C:/other" },
  ])
  expect(draft.problems.join(" ")).toContain("projects.0.vault")
  expect(draft.problems.join(" ")).toContain("projects.1.name")
})

test("syntactically invalid JSON explicitly requires confirmed replacement", () => {
  expect(inspectConfigForRepair("{ broken")).toMatchObject({
    replacementRequired: true,
    global: {},
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
    problems: [expect.stringContaining("not valid JSON")],
  })
})

test("repair never silently defaults runtime parse or drops a valid sibling after wrong limit", () => {
  expect(inspectConfigForRepair(JSON.stringify({ limits: { maxBodyChars: 0, maxStatementChars: 42 } }))).toMatchObject({
    limits: { maxBodyChars: 1000, maxStatementChars: 42 },
    global: {},
    projects: [],
    replacementRequired: false,
  })
})
