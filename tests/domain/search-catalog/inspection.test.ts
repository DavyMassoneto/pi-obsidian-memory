import { expect, test } from "vitest"

import {
  analyzeVaultNote,
  classifyAliasFailure,
  type InspectedVaultFile,
  inspectedCatalogEntry,
  reusableCatalogEntry,
  semanticFingerprint,
  type VaultCatalogEntry,
  type VaultCatalogFailure,
} from "#/domain"
import { aLimits, catalogEntry, frontmatterLinesWith, noteText, validFrontmatterLines } from "#test-helpers"

function inspectedFile(text: string, archived: boolean): InspectedVaultFile {
  return {
    path: "tools/Use pnpm.md",
    canonicalPath: "tools/Use pnpm.md",
    text,
    rawHash: "raw-two",
    stat: { size: 200, mtimeMs: 2000, ctimeMs: 3000, device: 1, inode: 2 },
    archived,
    analysis: analyzeVaultNote({ statement: "Use pnpm", text, archived, limits: aLimits() }),
  }
}

function catalogFailure(
  reason: VaultCatalogFailure["reason"],
  scope: VaultCatalogFailure["scope"],
): VaultCatalogFailure {
  return { succeeded: false, problems: ["problem one"], path: "alias", scope, reason }
}

test("maps a parsed note to an entry with the size and mtime stat and a semantic fingerprint", () => {
  const text = noteText(frontmatterLinesWith("dontForget: true"), "Install packages with pnpm.")
  const entry = inspectedCatalogEntry(inspectedFile(text, false), "limits-two")
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
  expect(inspectedCatalogEntry(inspectedFile(text, false), "limits-two").note?.dontForget).toBe(false)
  expect(inspectedCatalogEntry(inspectedFile(text, true), "limits-two").note?.archived).toBe(true)
})

test("maps an unclosed note to an entry without note or content fingerprint that needs fixing", () => {
  const entry = inspectedCatalogEntry(inspectedFile("---\nid: bad", false), "limits-two")
  expect(entry.note).toBeNull()
  expect(entry.contentFingerprint).toBeNull()
  expect(entry.needsFixing).toBe(true)
})

test("maps a parsed note without valid frontmatter to an entry without note", () => {
  const text = noteText(["id: not-a-ulid"], "Install packages with pnpm.")
  const entry = inspectedCatalogEntry(inspectedFile(text, false), "limits-two")
  expect(entry.note).toBeNull()
  expect(entry.contentFingerprint).toBeNull()
  expect(entry.needsFixing).toBe(true)
})

function vaultEntry(size: number, mtimeMs: number): VaultCatalogEntry {
  return {
    path: "tools/Old.md",
    kind: "note",
    archived: false,
    stat: { size, mtimeMs, ctimeMs: 1, device: 1, inode: 1 },
  }
}

test("reuses a cached entry only when fingerprint, size and mtime all match", () => {
  const cached = catalogEntry("tools/Old.md")
  expect(reusableCatalogEntry(vaultEntry(100, 1000), cached, "limits-one")).toBe(true)
  expect(reusableCatalogEntry(vaultEntry(100, 1000), cached, "limits-two")).toBe(false)
  expect(reusableCatalogEntry(vaultEntry(101, 1000), cached, "limits-one")).toBe(false)
  expect(reusableCatalogEntry(vaultEntry(100, 1001), cached, "limits-one")).toBe(false)
})

test("classifies excluded and cycle failures as retired aliases the same way", () => {
  for (const reason of ["excluded", "cycle"] as const) {
    expect(classifyAliasFailure(catalogFailure(reason, "directory"))).toEqual({
      kind: "untraversed-directory",
      path: "alias",
    })
    expect(classifyAliasFailure(catalogFailure(reason, "entry"))).toEqual({
      kind: "untraversed-directory",
      path: "alias",
    })
    expect(classifyAliasFailure(catalogFailure(reason, "file"))).toEqual({ kind: "excluded-file", path: "alias" })
  }
})

test("classifies every other failure as a failed path carrying its problems", () => {
  expect(classifyAliasFailure(catalogFailure("unreadable", "directory"))).toEqual({
    kind: "failed",
    path: "alias",
    problems: ["problem one"],
  })
  expect(classifyAliasFailure(catalogFailure("changed", "file"))).toMatchObject({ kind: "failed" })
})
