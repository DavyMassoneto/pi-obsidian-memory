import { expect, test } from "vitest"

import { catalogFolder, confirmedMissing } from "#/domain"
import { catalogScan } from "#test-helpers"

test("root failure protects every row and coverage means direct children only", () => {
  expect(confirmedMissing("tools/Note.md", { ...catalogScan([]), failedPaths: [""] })).toBe(false)
  expect(confirmedMissing("tools/deeper/Note.md", catalogScan([]))).toBe(true)
  const scan = { ...catalogScan([]), observedPaths: ["tools/deeper"] }
  expect(confirmedMissing("tools/deeper/Note.md", scan)).toBe(false)
  expect(confirmedMissing("tools/Missing.md", scan)).toBe(true)
})

test("folder identity preserves root and subject paths without using host separators", () => {
  expect(catalogFolder("Root note.md")).toBe("")
  expect(catalogFolder("tools/nested/Note.md")).toBe("tools/nested")
})
