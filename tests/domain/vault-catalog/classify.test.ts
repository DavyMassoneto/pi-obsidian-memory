import { expect, test } from "vitest"

import { catalogFileKind, isCatalogHidden, isCatalogNotePath, isRootArchive, isRootTemplate } from "#/domain"

test("classifies reserved roots case-insensitively, but nested names are ordinary subjects", () => {
  expect(catalogFileKind("INDEX.MD")).toBe("index")
  expect(catalogFileKind("Memory.base")).toBe("dashboard")
  expect(catalogFileKind("topic/Memory.base")).toBe("other")
  expect(catalogFileKind("_Templates/rule.md")).toBe("template")
  expect(catalogFileKind("topic/_templates/rule.md")).toBe("note")
  expect(catalogFileKind("topic/.a.md.tmp-123")).toBe("temporary")
  expect(isCatalogHidden("topic/.hidden/a.md")).toBe(true)
  expect(isRootArchive("Archive/a.md")).toBe(true)
  expect(isRootArchive("topic/archive/a.md")).toBe(false)
  expect(isRootTemplate("_Templates")).toBe(true)
})

test("memory paths allow dot Markdown basenames but exclude hidden parents and reserved files", () => {
  for (const path of [".md", ".Rule.md", "subject/.Rule.MD"]) {
    expect(isCatalogNotePath(path)).toBe(true)
  }
  for (const path of [".hidden/Rule.md", ".Rule.md/Note.md", "_templates/.Rule.md", "index.md", ".a.md.tmp-1"]) {
    expect(isCatalogNotePath(path)).toBe(false)
  }
  expect(isCatalogHidden("subject/.Rule.md")).toBe(true)
})

test("recognizes dashboard publication temporaries without treating ordinary hidden names as temporaries", () => {
  expect(catalogFileKind(".Memory.base.tmp-stale")).toBe("temporary")
  expect(catalogFileKind(".MEMORY.BASE.tmp-123")).toBe("temporary")
  expect(catalogFileKind(".Memory.base.tmp-")).toBe("other")
  expect(catalogFileKind(".Other.base.tmp-stale")).toBe("other")
  expect(catalogFileKind(".prefix.Memory.base.tmp-stale")).toBe("other")
  expect(catalogFileKind("Memory.base.tmp-stale")).toBe("other")
})
