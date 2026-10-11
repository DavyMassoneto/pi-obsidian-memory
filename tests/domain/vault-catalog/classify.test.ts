import { expect, test } from "vitest"

import { catalogFileKind, isCatalogHidden, isRootArchive, isRootTemplate } from "#/domain"

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

test("recognizes dashboard publication temporaries without treating ordinary hidden names as temporaries", () => {
  expect(catalogFileKind(".Memory.base.tmp-stale")).toBe("temporary")
  expect(catalogFileKind(".MEMORY.BASE.tmp-123")).toBe("temporary")
  expect(catalogFileKind(".Memory.base.tmp-")).toBe("other")
  expect(catalogFileKind(".Other.base.tmp-stale")).toBe("other")
  expect(catalogFileKind(".prefix.Memory.base.tmp-stale")).toBe("other")
  expect(catalogFileKind("Memory.base.tmp-stale")).toBe("other")
})
