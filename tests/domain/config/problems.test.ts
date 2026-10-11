import { expect, test } from "vitest"

import { parseConfig } from "#/domain"
import { aConfig } from "#test-helpers"

test("strict settings report every independent missing, wrong and unknown nested field", () => {
  const result = parseConfig(
    JSON.stringify({
      ...aConfig(),
      capture: { model: { provider: "", apiKey: "secret" }, when: "never", extra: 1 },
      memoryAgent: { model: { id: false }, extra: 1 },
      context: { budgetChars: 0, extra: 1 },
      limits: { maxBodyChars: 0, maxStatementChars: -1, maxNotesPerFolder: 1.5 },
    }),
  )
  expect(result.succeeded).toBe(false)
  if (result.succeeded) throw new Error("invalid config accepted")
  for (const field of [
    "capture.model.provider",
    "capture.model: must have required properties id",
    "capture.model.apiKey",
    "capture.when",
    "capture.extra",
    "memoryAgent.model: must have required properties provider",
    "memoryAgent.model.id",
    "memoryAgent.extra",
    "context.budgetChars",
    "context.extra",
    "limits.maxBodyChars",
    "limits.maxStatementChars",
    "limits.maxNotesPerFolder",
  ]) {
    expect(result.problems.join(" ")).toContain(field)
  }
  expect(result).not.toHaveProperty("output")
})

test("every unknown field and damaged project is named beyond the schema library error cap", () => {
  const projects = Array.from({ length: 30 }, () => ({ name: 1, folder: 2, vault: 3, secret: "discard" }))
  const result = parseConfig(JSON.stringify({ ...aConfig(), projects }))
  if (result.succeeded) throw new Error("damaged projects accepted")
  expect(result.problems).toHaveLength(120)
  for (let index = 0; index < projects.length; index++) {
    for (const key of ["name", "folder", "vault", "secret"]) {
      expect(result.problems.join(" ")).toContain(`projects.${index}.${key}`)
    }
  }
  expect(result.problems.join(" ")).not.toContain("discard")
})

test("closed choices name the accepted values rather than an opaque union failure", () => {
  const result = parseConfig(
    JSON.stringify({
      ...aConfig(),
      capture: { model: { provider: "chosen", id: "chosen" }, when: "never" },
      embeddings: { provider: "other", model: "other" },
      decisionModel: { provider: "typesafe", model: "other" },
    }),
  )
  if (result.succeeded) throw new Error("unsupported choices accepted")
  expect(result.problems).toContain("capture.when: must be one of after-each-turn, on-compaction, at-session-end")
  expect(result.problems).toContain("embeddings.provider: must be one of local, openai, google")
  expect(result.problems).toContain(
    "embeddings.model: must be one of Xenova/multilingual-e5-small, text-embedding-3-small, gemini-embedding-001",
  )
  expect(result.problems).toContain("decisionModel.model: must be one of jev-latest")
})

test.each([null, false, 42, [], "text"])("refuses a malformed root %j without a partial output", (root) => {
  expect(parseConfig(JSON.stringify(root))).toEqual({ succeeded: false, problems: ["config: must be object"] })
})
