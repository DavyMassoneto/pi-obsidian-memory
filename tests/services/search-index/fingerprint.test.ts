import { expect, test } from "vitest"

import { semanticFingerprint } from "#/services"

test("fingerprints exactly statement and body with unambiguous boundaries", () => {
  const content = { statement: "Use pnpm", body: "Keep trailing spaces.  \n" }
  const metadataChanged = { ...content, updated: "2026-10-04", path: "other/Note.md" }
  expect(semanticFingerprint(content)).toBe(semanticFingerprint(metadataChanged))
  expect(semanticFingerprint(content)).not.toBe(semanticFingerprint({ ...content, body: content.body.trim() }))
  expect(semanticFingerprint({ statement: "a", body: "bc" })).not.toBe(
    semanticFingerprint({ statement: "ab", body: "c" }),
  )
})
