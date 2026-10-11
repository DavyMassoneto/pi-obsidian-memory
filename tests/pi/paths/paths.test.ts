import { join } from "node:path"

import { expect, test } from "vitest"

import { memoryConfigPath } from "#/pi"

test("keeps the config in the pi agent folder", () => {
  expect(memoryConfigPath(join("C:", "agent"))).toBe(join("C:", "agent", "pi-obsidian-memory", "config.json"))
})
