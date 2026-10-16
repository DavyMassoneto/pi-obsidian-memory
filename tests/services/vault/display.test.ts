import { expect, test } from "vitest"

import { displayNotePath } from "#/services"

test.each([
  ["", "Rule", "Rule.md"],
  ["pnpm", "Rule", "pnpm/Rule.md"],
  ["tools/pnpm", "Rule", "tools/pnpm/Rule.md"],
  ["pnpm", "Use Node 20.x", "pnpm/Use Node 20.x.md"],
])("shows folder %j and statement %j as %j", (folder, statement, expected) => {
  expect(displayNotePath(folder, statement)).toBe(expected)
})
