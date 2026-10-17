import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { memoryConfigPath, memoryIndexPath, memoryModelCachePath } from "#src/pi"

test("keeps the config in the pi agent folder", () => {
  expect(memoryConfigPath(join("C:", "agent"))).toBe(join("C:", "agent", "pi-obsidian-memory", "config.json"))
})

test("keeps the search index beside the config, outside every vault", () => {
  expect(memoryIndexPath(join("C:", "agent"))).toBe(join("C:", "agent", "pi-obsidian-memory", "index"))
})

test("the model cache lives under the data folder, outside every vault", () => {
  const agent = join("C:", "agent")

  expect(memoryModelCachePath(agent)).toBe(join("C:", "agent", "pi-obsidian-memory", "models"))
  expect(memoryModelCachePath(agent).startsWith(dirname(memoryConfigPath(agent)))).toBe(true)
})
