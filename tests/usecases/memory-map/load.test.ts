import { expect, test } from "vitest"

import { loadMemoryMap } from "#src/usecases"
import { memoryReadFixture, noteText, putCatalogFile, validFrontmatterLines } from "#test-helpers"

test("the map loads active Markdown notes from disk and excludes archived or invalid notes", async () => {
  const { context, vault } = await memoryReadFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteText(validFrontmatterLines(), "Use pnpm."))
  await putCatalogFile(vault, "archive/Old rule.md", noteText(validFrontmatterLines(), "No longer active."))
  await putCatalogFile(vault, "Broken.md", "---\nno valid identity\n")
  const result = await loadMemoryMap(context)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  expect(result.output.notes).toEqual([
    expect.objectContaining({ scope: "global", path: "tools/Use pnpm.md", statement: "Use pnpm" }),
  ])
  expect(result.output.text).toContain("tools/Use pnpm.md")
  expect(result.output.text).not.toContain("Old rule")
  expect(result.output.text).not.toContain("Broken")
})
