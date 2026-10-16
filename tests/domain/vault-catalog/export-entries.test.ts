import { expect, test } from "vitest"

import { exportEntries } from "#src/domain"
import { exportFileAt } from "#test-helpers"

test("prefixes global and project files with their vault name, keeping bytes", () => {
  const global = [exportFileAt("tools/Use pnpm.md", "g"), exportFileAt("Memory.base", "b")]
  const project = [exportFileAt("tools/Use pnpm.md", "p")]

  expect(exportEntries(global, project)).toEqual([
    { path: "global/tools/Use pnpm.md", bytes: global[0]?.bytes },
    { path: "global/Memory.base", bytes: global[1]?.bytes },
    { path: "project/tools/Use pnpm.md", bytes: project[0]?.bytes },
  ])
})

test("exports only the global vault when there is no project vault", () => {
  expect(exportEntries([exportFileAt("a.md", "g")], null).map((entry) => entry.path)).toEqual(["global/a.md"])
})

test("exports nothing from empty vaults", () => {
  expect(exportEntries([], [])).toEqual([])
  expect(exportEntries([], null)).toEqual([])
})
