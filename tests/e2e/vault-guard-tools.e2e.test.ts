import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  e2eWorld,
  expectVaultRefusal,
  fileExists,
  noteWithId,
  runAllowed,
  toolsOnVault,
  vaultNotes,
  type WorldOptions,
  worldWithProjectVaultAsWorkingFolder,
  writeVaultFile,
} from "#test-helpers"

const worldOptions: WorldOptions = {
  memory: "configured",
  tools: ["grep", "find", "ls"],
  modelCache: "shared",
  capture: "at-session-end",
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

test("outside the vaults read, write, edit, grep, find and ls run, and the disk shows the write and the edit", async () => {
  const world = await e2eWorld(worldOptions)
  const { cwd } = world.folders
  const readme = join(cwd, "readme.txt")
  const editable = join(cwd, "editable.txt")
  const created = join(cwd, "created.txt")
  await writeFile(readme, "outside-7731")
  await writeFile(editable, "alpha beta")
  expect(await runAllowed(world, { tool: "read", args: { path: readme } })).toBe("outside-7731")
  await runAllowed(world, { tool: "write", args: { path: created, content: "created-5521" } })
  expect(await readFile(created, "utf8")).toBe("created-5521")
  await runAllowed(world, { tool: "edit", args: { path: editable, edits: [{ oldText: "beta", newText: "gamma" }] } })
  expect(await readFile(editable, "utf8")).toBe("alpha gamma")
  expect(await runAllowed(world, { tool: "grep", args: { pattern: "outside-7731", path: cwd } })).toBe(
    "readme.txt:1: outside-7731",
  )
  expect(await runAllowed(world, { tool: "find", args: { pattern: "readme*", path: cwd } })).toBe("readme.txt")
  expect(await runAllowed(world, { tool: "ls", args: { path: cwd } })).toBe("created.txt\neditable.txt\nreadme.txt")
  expect(await fileExists(join(world.folders.globalVault, "created.txt"))).toBe(false)
})

test("memory_get, a tool the guard does not know, reads a project note by its relative path while the project vault is the working folder", async () => {
  const world = await worldWithProjectVaultAsWorkingFolder(worldOptions)
  const note = noteWithId(1, "Always pnpm.", [])
  await writeVaultFile(world.folders.cwd, "tools/Use pnpm.md", note)
  const text = await runAllowed(world, { tool: "memory_get", args: { vault: "project", path: "tools/Use pnpm.md" } })
  expect(text).toBe(`project · tools/Use pnpm.md\n${note}`)
})
