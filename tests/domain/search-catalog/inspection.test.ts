import { expect, test } from "vitest"

import { classifyAliasFailure, inspectedCatalogEntry, reusableCatalogEntry, semanticFingerprint } from "#src/domain"
import {
  aCatalogFailure,
  anInspectedFile,
  aVaultCatalogEntry,
  catalogEntry,
  frontmatterLinesWith,
  noteText,
  validFrontmatterLines,
} from "#test-helpers"

test("maps a parsed note to an entry with the size and mtime stat and a semantic fingerprint", () => {
  const text = noteText(frontmatterLinesWith("dontForget: true"), "Install packages with pnpm.")
  const entry = inspectedCatalogEntry(anInspectedFile(text, false), "limits-two")
  expect(entry).toEqual({
    path: "tools/Use pnpm.md",
    stat: { size: 200, mtimeMs: 2000 },
    rawHash: "raw-two",
    contentFingerprint: semanticFingerprint({ statement: "Use pnpm", body: "Install packages with pnpm." }),
    validationFingerprint: "limits-two",
    note: {
      id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
      type: "rule",
      statement: "Use pnpm",
      body: "Install packages with pnpm.",
      dontForget: true,
      archived: false,
    },
    needsFixing: false,
  })
})

test("marks a note without dontForget as not dontForget and an archived note as archived", () => {
  const text = noteText(validFrontmatterLines(), "Install packages with pnpm.")
  expect(inspectedCatalogEntry(anInspectedFile(text, false), "limits-two").note?.dontForget).toBe(false)
  expect(inspectedCatalogEntry(anInspectedFile(text, true), "limits-two").note?.archived).toBe(true)
})

test("maps an unclosed note to an entry without note or content fingerprint that needs fixing", () => {
  const entry = inspectedCatalogEntry(anInspectedFile("---\nid: bad", false), "limits-two")
  expect(entry.note).toBeNull()
  expect(entry.contentFingerprint).toBeNull()
  expect(entry.needsFixing).toBe(true)
})

test("maps a parsed note without valid frontmatter to an entry without note", () => {
  const text = noteText(["id: not-a-ulid"], "Install packages with pnpm.")
  const entry = inspectedCatalogEntry(anInspectedFile(text, false), "limits-two")
  expect(entry.note).toBeNull()
  expect(entry.contentFingerprint).toBeNull()
  expect(entry.needsFixing).toBe(true)
})

test("reuses a cached entry only when fingerprint, size and mtime all match", () => {
  const cached = catalogEntry("tools/Old.md")
  expect(reusableCatalogEntry(aVaultCatalogEntry(100, 1000), cached, "limits-one")).toBe(true)
  expect(reusableCatalogEntry(aVaultCatalogEntry(100, 1000), cached, "limits-two")).toBe(false)
  expect(reusableCatalogEntry(aVaultCatalogEntry(101, 1000), cached, "limits-one")).toBe(false)
  expect(reusableCatalogEntry(aVaultCatalogEntry(100, 1001), cached, "limits-one")).toBe(false)
})

test("classifies excluded and cycle failures as retired aliases the same way", () => {
  for (const reason of ["excluded", "cycle"] as const) {
    expect(classifyAliasFailure(aCatalogFailure(reason, "directory"))).toEqual({
      kind: "untraversed-directory",
      path: "alias",
    })
    expect(classifyAliasFailure(aCatalogFailure(reason, "entry"))).toEqual({
      kind: "untraversed-directory",
      path: "alias",
    })
    expect(classifyAliasFailure(aCatalogFailure(reason, "file"))).toEqual({ kind: "excluded-file", path: "alias" })
  }
})

test("classifies every other failure as a failed path carrying its problems", () => {
  expect(classifyAliasFailure(aCatalogFailure("unreadable", "directory"))).toEqual({
    kind: "failed",
    path: "alias",
    problems: ["problem one"],
  })
  expect(classifyAliasFailure(aCatalogFailure("changed", "file"))).toMatchObject({ kind: "failed" })
})
