import { expect, test } from "vitest"

import { ancestorFolders, joinVaultPath } from "#/domain"

test("joins vault path parts, skipping empty ones", () => {
  expect(joinVaultPath("", "pnpm", "", "index")).toBe("pnpm/index")
})

test.each([
  ["a nested folder", "tools/pnpm/ci", ["tools/pnpm/ci", "tools/pnpm", "tools", ""]],
  ["a top-level folder", "pnpm", ["pnpm", ""]],
  ["the vault root", "", [""]],
])("lists %s and every folder above it, up to the root", (_case, folder, expected) => {
  expect(ancestorFolders(folder)).toEqual(expected)
})
