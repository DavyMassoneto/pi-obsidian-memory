import { expect, test } from "vitest"

import { respondToGet } from "#src/pi"
import { deliveredRead, getResponses, textOf } from "#test-helpers"

const request = { vault: "global", path: "Rules/Keep Case.MD" } as const

test("a note comes back as its vault and path, then its full text", () => {
  const read = deliveredRead()
  const clean = { ...read, analysis: { ...read.analysis, frontmatterProblems: [], nameProblems: [], bodyProblems: [] } }

  const response = respondToGet(request, { succeeded: true, output: { kind: "note", vault: "global", file: clean } })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(`global · Rules/Keep Case.MD\n${read.text}`)
})

test("every problem of a note is listed after its text under Needs fixing", () => {
  const note = getResponses()[0]
  if (!note) throw new Error("note response missing")

  const response = respondToGet(request, note)

  expect(response.isError).toBe(false)
  expect(textOf(response)).toContain(
    "Needs fixing:\n- diagnostic frontmatter problem\n- diagnostic name problem\n- diagnostic body problem",
  )
})

test("a folder comes back as its index text only", () => {
  const folder = getResponses()[1]
  if (!folder) throw new Error("folder response missing")

  expect(textOf(respondToGet(request, folder))).toBe("index text")
})

test("a file with no closed frontmatter block is an error that says so and lists its problems", () => {
  const response = respondToGet(request, {
    succeeded: false,
    reason: "unclosed-frontmatter",
    problems: ["frontmatter is not closed"],
    file: deliveredRead(),
  })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    "This file cannot be read as a note: it has no closed frontmatter block.\nNeeds fixing:\n- frontmatter is not closed",
  )
})

test.each(["not-configured", "invalid-config"] as const)("a %s config refusal points to /memory-setup", (reason) => {
  const response = respondToGet(request, {
    succeeded: false,
    reason,
    problems: ["config problem"],
    configPath: "c.json",
  })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("config problem\nMemory is off: ask the user to run /memory-setup.")
})

test.each([
  { succeeded: false, reason: "not-found", problems: ["first", "second"], path: "x.md", scope: "entry" },
  { succeeded: false, reason: "no-project", problems: ["first", "second"], workingFolder: "work" },
  { succeeded: false, reason: "cancelled", problems: ["first", "second"] },
] as const)("any other refusal ($reason) gives its problems as an error", (refusal) => {
  const response = respondToGet(request, { ...refusal, problems: [...refusal.problems] })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("first\nsecond")
})
