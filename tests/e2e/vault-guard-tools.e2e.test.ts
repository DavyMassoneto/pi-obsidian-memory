import { expect, test } from "vitest"

import {
  e2eWorld,
  expectVaultRefusal,
  noteWithId,
  toolsOnVault,
  vaultNotes,
  type WorldOptions,
  writeVaultFile,
} from "#test-helpers"

const worldOptions: WorldOptions = {
  memory: "configured",
  tools: ["grep", "find", "ls"],
  modelCache: "shared",
}

test("read, write, edit, grep, find and ls on the global or the project vault are refused and both vaults are unchanged", async () => {
  const world = await e2eWorld(worldOptions)
  const { globalVault, projectVault } = world.folders
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await writeVaultFile(projectVault, "tools/Use pnpm.md", noteWithId(2, "Always pnpm.", []))
  const before = [await vaultNotes(globalVault), await vaultNotes(projectVault)]
  for (const vault of [globalVault, projectVault]) {
    for (const call of toolsOnVault(vault)) await expectVaultRefusal(world, call)
  }
  expect([await vaultNotes(globalVault), await vaultNotes(projectVault)]).toEqual(before)
})
