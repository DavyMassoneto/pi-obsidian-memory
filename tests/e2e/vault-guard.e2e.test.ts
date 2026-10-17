import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { e2eWorld, expectVaultRefusal, noteWithId, runAllowed, vaultNotes, writeVaultFile } from "#test-helpers"

test("read, write, bash and powershell on a vault file are refused and the vault is unchanged", async () => {
  const world = await e2eWorld({
    memory: "configured",
    tools: ["powershell"],
    modelCache: "shared",
    capture: "at-session-end",
  })
  await writeVaultFile(world.folders.globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const note = join(world.folders.globalVault, "tools", "Use pnpm.md")
  const before = await readFile(note, "utf8")
  const notesBefore = await vaultNotes(world.folders.globalVault)
  await expectVaultRefusal(world, { tool: "read", args: { path: note } })
  await expectVaultRefusal(world, { tool: "write", args: { path: note, content: "replaced" } })
  await expectVaultRefusal(world, { tool: "bash", args: { command: `cat '${note.replaceAll("\\", "/")}'` } })
  await expectVaultRefusal(world, { tool: "powershell", args: { command: `Get-Content -LiteralPath '${note}'` } })
  expect(await readFile(note, "utf8")).toBe(before)
  expect(await vaultNotes(world.folders.globalVault)).toEqual(notesBefore)
})

test("outside the vaults the read tool works, and pi lists the shipped obsidian-memory skill", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const outside = join(world.folders.cwd, "readme.txt")
  await writeFile(outside, "outside-7731")
  expect(await runAllowed(world, { tool: "read", args: { path: outside } })).toBe("outside-7731")
  expect(await world.pi.commands()).toContainEqual(
    expect.objectContaining({ name: "skill:obsidian-memory", source: "skill" }),
  )
})
