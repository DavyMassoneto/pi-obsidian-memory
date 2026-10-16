import { expect, test } from "vitest"

import { loadIsolatedPi } from "#test-helpers"

test("pi loads the package, registers its tool and commands, and offers /memory-setup when there is no config", async () => {
  const loaded = await loadIsolatedPi()

  expect(loaded.toolNames).toContain("memory_add")
  expect(loaded.commandNames).toEqual(expect.arrayContaining(["memory-setup", "memory-init"]))
  expect(loaded.startNotifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "info" }])
})
