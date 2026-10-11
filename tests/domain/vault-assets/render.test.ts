import { expect, test } from "vitest"
import { isMap, isScalar, isSeq, parseDocument } from "yaml"

import { readFrontmatter, renderVaultAssets } from "#/domain"

test("hand templates use invalid explicit ULID placeholder, date placeholders, and all twelve types", () => {
  const assets = renderVaultAssets()
  const templates = assets.filter((asset) => asset.path.startsWith("_templates/"))
  expect(templates).toHaveLength(12)
  expect(new Set(templates.map((template) => template.path)).size).toBe(12)
  for (const template of templates) {
    expect(template.content).toContain("id: REPLACE_WITH_NEW_ULID")
    expect(template.content).toContain('updated: "{{date:YYYY-MM-DD}}"')
    const frontmatter = template.content.split("---")[1]
    expect(typeof frontmatter).toBe("string")
    if (typeof frontmatter === "string") expect(readFrontmatter(frontmatter).succeeded).toBe(false)
  }
})

test("dashboard has three concrete YAML views and anchored root exclusions", () => {
  const dashboard = renderVaultAssets().find((asset) => asset.path === "Memory.base")
  expect(dashboard).toBeDefined()
  if (!dashboard) return
  const document = parseDocument(dashboard.content)
  expect(document.errors).toEqual([])
  expect(isMap(document.contents)).toBe(true)
  if (!isMap(document.contents)) return
  const views = document.contents.get("views", true)
  expect(isSeq(views)).toBe(true)
  if (!isSeq(views)) return
  expect(views.items).toHaveLength(3)
  const names = views.items.map((view) => {
    if (!isMap(view)) return null
    const name = view.get("name", true)
    if (!isScalar(name) || typeof name.value !== "string") return null
    return name.value
  })
  expect(names).toEqual(["All notes", "Don't forget", "Archive"])
  expect(dashboard.content).toContain('!file.path.lower().startsWith("_templates/")')
  expect(dashboard.content).toContain('file.path.lower().startsWith("archive/")')
  expect(dashboard.content).toContain('file.basename.lower() != "index"')
  expect(dashboard.content).toContain("note.dontForget")
})
