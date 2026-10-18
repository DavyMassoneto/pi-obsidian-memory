import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderVaultAssets } from "#src/domain"
import { MEMORY_SETUP_COMMAND, RELOAD_NOTE, SETUP_CANCELLED, SETUP_CREATE_OPTION, SETUP_DONE } from "#src/pi"
import { firstSetupSteps, noMemoryWorld, notifySettles, storedConfig } from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])

test("first /memory-setup with Create a new vault makes the vault with every asset and says where, with the /reload note", async () => {
  const world = await noMemoryWorld({})
  const vault = join(world.folders.root, "created-vault")
  const turn = await world.pi.command(`/${MEMORY_SETUP_COMMAND}`, firstSetupSteps(SETUP_CREATE_OPTION, vault), settles)
  const saved = (await storedConfig(world)).global.vault
  const done = turn.notifications.at(-1)
  expect(turn.notifications).toHaveLength(2)
  expect(done?.notifyType).toBe("info")
  expect(done?.message.startsWith(`${SETUP_DONE} ${saved}`)).toBe(true)
  expect(done?.message.endsWith(RELOAD_NOTE)).toBe(true)
  for (const asset of renderVaultAssets()) expect(await readFile(join(saved, asset.path), "utf8")).toBe(asset.content)
  expect(world.pi.unexpected).toEqual([])
})
