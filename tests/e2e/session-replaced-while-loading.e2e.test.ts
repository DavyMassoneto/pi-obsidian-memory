import { test } from "vitest"

import { expectReplacementSession, loadingWorld } from "#test-helpers"

test("a new session started while the startup memory load runs keeps pi alive and loads its own memory", async () => {
  const world = await loadingWorld({})
  const from = world.pi.lines.length
  await world.pi.newSession()
  await expectReplacementSession(world, from)
})
