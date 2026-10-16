import { readdir } from "node:fs/promises"

import { expect, test } from "vitest"

import { addMemory } from "#src/usecases"
import { operationContextFor, setupVaults } from "#test-helpers"

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

test("saving waits for the session lease held by another operation and then goes on", async () => {
  const { configPath, unregisteredFolder } = await setupVaults()
  const context = operationContextFor({ configPath, workingFolder: unregisteredFolder })
  const held = await context.session.acquire(context.stamp, context.signal)
  if (!held) throw new Error("lease expected")

  const saving = addMemory({ scope: "global", folder: "pnpm", draft }, context)
  const early = await Promise.race([
    saving,
    new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 150)),
  ])
  held.release()

  expect(early).toBe("waiting")
  expect(await saving).toMatchObject({ succeeded: true })
})

test("saving is refused once the session was replaced or is shutting down, and writes nothing", async () => {
  const { configPath, unregisteredFolder, globalVault } = await setupVaults()
  const stale = operationContextFor({ configPath, workingFolder: unregisteredFolder })
  stale.session.invalidate(stale.stamp)
  const closing = operationContextFor({ configPath, workingFolder: unregisteredFolder })
  closing.session.abortPending()

  expect(await addMemory({ scope: "global", folder: "pnpm", draft }, stale)).toMatchObject({
    succeeded: false,
    reason: "stale-session",
  })
  expect(await addMemory({ scope: "global", folder: "pnpm", draft }, closing)).toMatchObject({ succeeded: false })
  expect(await readdir(globalVault)).toEqual([])
})
