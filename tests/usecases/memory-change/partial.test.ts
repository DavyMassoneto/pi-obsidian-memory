import { expect, test } from "vitest"

import type { PartialRelocation } from "#src/services"
import { reportPartial } from "#src/usecases"
import { aNote } from "#test-helpers"

test("a partial relocation lists what was published by display path and keeps the original's state", () => {
  const partial: PartialRelocation = {
    succeeded: false,
    reason: "partial",
    cause: { succeeded: false, reason: "io-error", problems: ["disk full"] },
    problems: ["disk full", "index warning"],
    written: [
      { folder: "archive/tools", note: { ...aNote(), statement: "Use pnpm" } },
      { folder: "", note: { ...aNote(), statement: "At the root" } },
    ],
    originalState: "unknown",
  }

  expect(reportPartial(partial)).toEqual({
    succeeded: false,
    reason: "partial",
    problems: ["disk full", "index warning"],
    published: ["archive/tools/Use pnpm.md", "At the root.md"],
    originalState: "unknown",
  })
})

test("any other refusal passes through untouched", () => {
  const refusal = { succeeded: false as const, reason: "conflict", problems: ["changed"] }

  expect(reportPartial(refusal)).toBe(refusal)
})
