import { expect, it } from "vitest"

import { CAPTURE_POLICY } from "#src/services"

it.each([
  "Scope follows the note's content",
  "Never generalize a project's rule to make it global",
  "If unsure whether a note is global or project, use project, never global",
  "search the project vault too",
  "scopeReason",
])("capture policy contains: %s", (text) => {
  expect(CAPTURE_POLICY).toContain(text)
})

it("no longer tells the model to strip project specifics", () => {
  expect(CAPTURE_POLICY).not.toContain("never a project's name")
})
