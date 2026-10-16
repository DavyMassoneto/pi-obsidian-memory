import { createHash } from "node:crypto"

import { expect, test } from "vitest"

import { catalogValidationFingerprint } from "#src/services"

const limits = { maxStatementChars: 100, maxBodyChars: 1000, maxNotesPerFolder: 20 }

test("validation fingerprint is deterministic and independent of key order", () => {
  const reordered = { maxNotesPerFolder: 20, maxBodyChars: 1000, maxStatementChars: 100 }
  expect(catalogValidationFingerprint(limits)).toBe(catalogValidationFingerprint({ ...limits }))
  expect(catalogValidationFingerprint(limits)).toBe(catalogValidationFingerprint(reordered))
})

test.each([
  ["maxStatementChars", { ...limits, maxStatementChars: 101 }],
  ["maxBodyChars", { ...limits, maxBodyChars: 1001 }],
  ["maxNotesPerFolder", { ...limits, maxNotesPerFolder: 21 }],
])("validation fingerprint changes when %s changes", (_field, changed) => {
  expect(catalogValidationFingerprint(changed)).not.toBe(catalogValidationFingerprint(limits))
})

test("validation fingerprint distinguishes values moved between limits", () => {
  const swapped = { maxStatementChars: 1000, maxBodyChars: 100, maxNotesPerFolder: 20 }
  expect(catalogValidationFingerprint(swapped)).not.toBe(catalogValidationFingerprint(limits))
})

test("validation fingerprint is a sha256 hex of the policy and the limits in fixed order", () => {
  const expected = createHash("sha256")
    .update(JSON.stringify(["vault-note-analysis-v1", 100, 1000, 20]))
    .digest("hex")
  expect(catalogValidationFingerprint(limits)).toBe(expected)
})
