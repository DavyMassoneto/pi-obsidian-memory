import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { SHELL_EDIT_REFUSED, VAULT_ACCESS_REFUSAL } from "#src/domain"
import { memoryIndexPath } from "#src/pi"
import {
  callInNewSession,
  configText,
  e2eWorld,
  expectVaultRefusal,
  fileExists,
  noteWithId,
  runAllowed,
  slashed,
  startedCalls,
  toolText,
  type WorldOptions,
  writeVaultFile,
} from "#test-helpers"

const options: WorldOptions = {
  memory: "configured",
  tools: ["powershell"],
  modelCache: "shared",
  capture: "at-session-end",
}

test("bash and powershell naming a vault path are refused with the vault refusal, and the same commands on another file run", async () => {
  const world = await e2eWorld(options)
  const { globalVault, projectVault, cwd } = world.folders
  await writeVaultFile(projectVault, "Note.md", noteWithId(1, "Project note.", []))
  const note = join(projectVault, "Note.md")
  const outside = join(cwd, "outside.txt")
  await writeFile(outside, "outside-9902")
  await expectVaultRefusal(world, { tool: "bash", args: { command: `cat '${slashed(note)}'` } })
  await expectVaultRefusal(world, { tool: "powershell", args: { command: `Get-Content -LiteralPath '${note}'` } })
  await expectVaultRefusal(world, { tool: "bash", args: { command: `ls '${slashed(globalVault)}'` } })
  expect(await runAllowed(world, { tool: "bash", args: { command: `cat '${slashed(outside)}'` } })).toBe("outside-9902")
  expect(
    await runAllowed(world, { tool: "powershell", args: { command: `Get-Content -LiteralPath '${outside}'` } }),
  ).toBe("outside-9902\r\n")
})

test("bash and powershell read the config file, and the shell-edit guard, not the vault guard, refuses a redirect into it", async () => {
  const world = await e2eWorld(options)
  const { configPath } = world.folders
  const text = await configText(world)
  const command = `echo {} > '${slashed(configPath)}'`
  expect.soft(await runAllowed(world, { tool: "bash", args: { command: `cat '${slashed(configPath)}'` } })).toBe(text)
  expect
    .soft(
      await runAllowed(world, { tool: "powershell", args: { command: `Get-Content -LiteralPath '${configPath}'` } }),
    )
    .toBe(text.replaceAll("\n", "\r\n"))
  const { turn, end } = await callInNewSession(world, { tool: "bash", args: { command } })
  expect(startedCalls(turn)).toEqual([{ tool: "bash", args: { command } }])
  expect(end.isError).toBe(true)
  expect(toolText(end)).toContain(SHELL_EDIT_REFUSED)
  expect(toolText(end)).not.toContain(VAULT_ACCESS_REFUSAL)
  expect(await readFile(configPath, "utf8")).toBe(text)
})

test.each([
  ["bash", (index: string) => `rm -rf '${slashed(index)}'`],
  ["powershell", (index: string) => `Remove-Item -Recurse -Force -LiteralPath '${index}'`],
])("%s removes the index folder", async (tool, commandFor) => {
  const world = await e2eWorld(options)
  const index = memoryIndexPath(world.folders.agentDir)
  await mkdir(index, { recursive: true })
  await writeFile(join(index, "a.sqlite"), "index")
  await runAllowed(world, { tool, args: { command: commandFor(index) } })
  expect(await fileExists(index)).toBe(false)
})
