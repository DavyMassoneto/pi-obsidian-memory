import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { hostPathPlatform, memoryConfigPath, memoryIndexPath, memoryModelCachePath } from "#src/pi"

test.each([
  ["win32", "win32"],
  ["darwin", "darwin"],
  ["linux", "linux"],
  ["freebsd", "linux"],
] as const)("the host %s uses the %s path rules", (host, expected) => {
  expect(hostPathPlatform(host)).toBe(expected)
})

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
