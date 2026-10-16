import { expect, test } from "vitest"

import { planCatalogChanges } from "#/domain"
import { catalogEntry, catalogScan, catalogSnapshot } from "#test-helpers"

test("retires positively excluded alias identities without fabricating missing-directory coverage", () => {
  const physical = catalogEntry("physical/Note.md")
  const entries = [catalogEntry("alias/Old.md"), catalogEntry("Alias.md"), physical]
  const scan = {
    ...catalogScan([physical]),
    observedPaths: ["alias", "Alias.md", "physical", "physical/Note.md"],
    completeDirectories: ["", "physical"],
    untraversedAliasDirectories: ["alias"],
    excludedAliasFiles: ["Alias.md"],
  }
  expect(planCatalogChanges(catalogSnapshot(entries), scan).deletes).toEqual(["alias/Old.md", "Alias.md"])
  expect(planCatalogChanges(catalogSnapshot(entries), { ...scan, failedPaths: ["alias", "Alias.md"] }).deletes).toEqual(
    [],
  )
})

test("keys copies by path and deletes only covered missing children", () => {
  const old = catalogEntry("tools/Old.md")
  const next = catalogEntry("tools/New.md")
  const copy = catalogEntry("tools/Copy.md")
  const result = planCatalogChanges(catalogSnapshot([old]), catalogScan([next, copy]))
  expect(result.upserts).toEqual([next, copy])
  expect(result.deletes).toEqual([old.path])
  expect(result.duplicateIds).toEqual([{ id: next.note?.id, paths: [copy.path, next.path] }])
  expect(result.population).toBe("ready")
})

test("deletes a cached note when successful enumeration proves its path is now a directory", () => {
  const old = catalogEntry("tools/Old.md")
  const scan = {
    ...catalogScan([]),
    observedPaths: ["tools", old.path],
    completeDirectories: ["", "tools", old.path],
  }
  const plan = planCatalogChanges(catalogSnapshot([old]), scan)

  expect(plan.deletes).toEqual([old.path])
  expect(plan.upserts).toEqual([])
  expect(plan.population).toBe("ready")
})

test("retains a cached note when enumeration of its replacement directory fails", () => {
  const old = catalogEntry("tools/Old.md")
  const scan = {
    ...catalogScan([]),
    observedPaths: ["tools", old.path],
    failedPaths: [old.path],
    complete: false,
  }
  const plan = planCatalogChanges(catalogSnapshot([old]), scan)

  expect(plan.deletes).toEqual([])
  expect(plan.upserts).toEqual([])
})

test("failed ancestors protect notes even when successful directory coverage overlaps", () => {
  const old = catalogEntry("tools/Old.md")
  const scan = {
    ...catalogScan([]),
    observedPaths: ["tools", old.path],
    completeDirectories: ["", "tools", old.path],
    failedPaths: ["tools"],
    complete: false,
  }

  expect(planCatalogChanges(catalogSnapshot([old]), scan).deletes).toEqual([])
})

test("retains unreadable files and descendants even if an ancestor listing completed", () => {
  const cached = [catalogEntry("tools/Old.md"), catalogEntry("tools/nested/Old.md")]
  const scan = { ...catalogScan([]), observedPaths: ["tools/Old.md"], failedPaths: ["tools/nested"], complete: false }
  const result = planCatalogChanges(catalogSnapshot(cached), scan)
  expect(result.deletes).toEqual([])
  expect(result.population).toBe("ready")
})

test("does not infer recursive coverage and deletes vanished directory descendants only with absence evidence", () => {
  const old = catalogEntry("gone/nested/Old.md")
  const scan = { ...catalogScan([]), completeDirectories: [""], observedPaths: ["gone"] }
  expect(planCatalogChanges(catalogSnapshot([old]), scan).deletes).toEqual([])
  expect(planCatalogChanges(catalogSnapshot([old]), { ...scan, observedPaths: [] }).deletes).toEqual([old.path])
  expect(planCatalogChanges(catalogSnapshot([old]), { ...scan, failedPaths: ["gone"] }).deletes).toEqual([])
  const failedDescendant = { ...scan, observedPaths: [], failedPaths: ["gone/other/Locked.md"] }
  expect(planCatalogChanges(catalogSnapshot([old]), failedDescendant).deletes).toEqual([])
})

test("distinguishes stat-only touches, changed validation and newly invalid frontmatter", () => {
  const old = catalogEntry("tools/Old.md")
  const touched = { ...old, stat: { ...old.stat, mtimeMs: 2000 } }
  const plan = planCatalogChanges(catalogSnapshot([old]), catalogScan([touched]))
  expect(plan.upserts).toEqual([])
  expect(plan.statUpdates).toEqual([{ path: old.path, stat: touched.stat }])
  const invalid = { ...old, note: null, needsFixing: true, rawHash: "broken", contentFingerprint: null }
  expect(planCatalogChanges(catalogSnapshot([old]), catalogScan([invalid])).upserts).toEqual([invalid])
  const revalidated = { ...old, needsFixing: true, validationFingerprint: "lower-limits" }
  const scan = { ...catalogScan([revalidated]), validationFingerprint: "lower-limits" }
  expect(planCatalogChanges(catalogSnapshot([old]), scan).upserts).toEqual([revalidated])
})

test("initial partial population and unrevalidated unchanged rows never become ready", () => {
  const old = catalogEntry("tools/Old.md")
  const snapshot = { ...catalogSnapshot([old]), population: "needs-population" as const }
  expect(planCatalogChanges(snapshot, { ...catalogScan([]), complete: false }).population).toBe("needs-population")
  const scan = { ...catalogScan([old]), validationFingerprint: "lower-limits" }
  const result = planCatalogChanges(snapshot, scan)
  expect(result.reinspectPaths).toEqual([old.path])
  expect(result.population).toBe("needs-population")
})
