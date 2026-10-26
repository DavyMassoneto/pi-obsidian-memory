import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  e2eWorld,
  expectVaultRefusal,
  noteWithId,
  runAllowed,
  slashed,
  type WorldOptions,
  writeVaultFile,
} from "#test-helpers"

const options: WorldOptions = {
  memory: "configured",
  tools: ["powershell"],
  modelCache: "shared",
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
