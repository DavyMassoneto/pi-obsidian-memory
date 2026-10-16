import { expect, test } from "vitest"

import { respondToSearch } from "#src/pi"
import { searchResponses, textOf } from "#test-helpers"

const hit = {
  path: "typescript/No ternaries.md",
  id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
  statement: "No ternaries",
  type: "rule",
  score: 1,
  dontForget: false,
  needsFixing: false,
} as const

test("each hit is a line with its vault, path and type, then the marks that apply, grouped by vault", () => {
  const response = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: false,
      semantic: { mode: "text-only", problems: [] },
      vaults: [
        {
          vault: "global",
          hits: [hit, { ...hit, path: "Mark.md", dontForget: true, needsFixing: true }],
          warnings: [],
        },
        { vault: "project", hits: [{ ...hit, path: "Deploy.md" }], warnings: [] },
      ],
    },
  })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(
    [
      "global · typescript/No ternaries.md · rule",
      "global · Mark.md · rule · don't forget · needs fixing",
      "project · Deploy.md · rule",
    ].join("\n"),
  )
})

test("no hits says where it looked and how to read on", () => {
  const response = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: false,
      semantic: { mode: "text-only", problems: [] },
      vaults: [
        { vault: "global", hits: [], warnings: [] },
        { vault: "project", hits: [], warnings: [] },
      ],
    },
  })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(
    'No notes found in global, project. Try other words or walk folders with memory_get (path "" is the vault root).',
  )
})

test("a vault that could not be searched and the warnings of the others are listed after the hits", () => {
  const response = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: false,
      semantic: { mode: "text-only", problems: [] },
      vaults: [
        { vault: "global", hits: [hit], warnings: ["index closed late"] },
        { vault: "project", problems: ["vault is missing"] },
      ],
    },
  })

  expect(textOf(response)).toBe(
    [
      "global · typescript/No ternaries.md · rule",
      "Could not search project: vault is missing",
      "Warning: index closed late",
    ].join("\n"),
  )
})

test("a folder with no registered project says so after the other lines", () => {
  const response = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: true,
      semantic: { mode: "text-only", problems: [] },
      vaults: [{ vault: "global", hits: [hit], warnings: [] }],
    },
  })

  expect(textOf(response)).toBe(
    "global · typescript/No ternaries.md · rule\nNo project vault is registered for this folder.",
  )
})

test("a search that no vault answered is an error", () => {
  const response = respondToSearch({
    succeeded: true,
    output: { projectMissing: true, semantic: { mode: "text-only", problems: [] }, vaults: [] },
  })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("No project vault is registered for this folder.")
})

test.each(["not-configured", "invalid-config"] as const)("a %s config refusal points to /memory-setup", (reason) => {
  const response = respondToSearch({ succeeded: false, reason, problems: ["config problem"], configPath: "c.json" })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("config problem\nMemory is off: ask the user to run /memory-setup.")
})

test("any other refusal gives its problems as an error", () => {
  const refusal = searchResponses().at(-1)
  if (!refusal) throw new Error("refusal missing")

  const response = respondToSearch(refusal)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("a problem")
})

test("the semantic status lines come after the hits and warnings, before the missing-project line", () => {
  const response = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: true,
      semantic: { mode: "text-only", problems: ["Semantic search is off: model download declined"] },
      vaults: [{ vault: "global", hits: [hit], warnings: ["a warning"] }],
    },
  })

  expect(textOf(response)).toBe(
    [
      "global · typescript/No ternaries.md · rule",
      "Warning: a warning",
      "Semantic search is off: model download declined",
      "No project vault is registered for this folder.",
    ].join("\n"),
  )
})
