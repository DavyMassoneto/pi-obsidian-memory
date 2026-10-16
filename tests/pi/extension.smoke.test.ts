import { expect, test } from "vitest"

import { loadIsolatedPi } from "#test-helpers"

test("pi loads the package, registers its tools and commands, and offers /memory-setup when there is no config", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.toolNames).toEqual(expect.arrayContaining(["memory_add", "memory_search", "memory_get"]))
  expect(loaded.commandNames).toEqual(expect.arrayContaining(["memory-setup", "memory-init"]))
  expect(loaded.startNotifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "info" }])
})

test("pi lists the obsidian-memory skill shipped with the package", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.skillNames).toContain("obsidian-memory")
})
