import { expect, test } from "vitest"

import { loadIsolatedPi } from "#test-helpers"

test("pi loads the package, registers its tools and commands, and offers /memory-setup when there is no config", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.toolNames).toEqual(
    expect.arrayContaining([
      "memory_add",
      "memory_search",
      "memory_get",
      "memory_update",
      "memory_archive",
      "memory_succeed",
    ]),
  )
  expect(loaded.commandNames).toEqual(expect.arrayContaining(["memory-setup", "memory-init"]))
  expect(loaded.startNotifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "info" }])
})

test("pi lists the obsidian-memory skill shipped with the package", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.skillNames).toContain("obsidian-memory")
})

test("pi runs the vault guard on tool calls: a vault file is blocked and another file is not", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.guarded).toEqual({ inside: true, outside: false })
})
