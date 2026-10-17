import { readdir, readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  DISCLOSURE_TITLE,
  RELOAD_NOTE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CREATE_OPTION,
  SETUP_DONE,
  SETUP_KEEP_VAULT_TITLE,
  SETUP_MODE_TITLE,
} from "#src/pi"
import {
  configText,
  configuredWorld,
  leaveScreen,
  modeStep,
  optionsOf,
  pickLine,
  pressEscape,
  settingsScreen,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const bytes = Buffer.from([0, 255, 13, 10])

test("the settings screen can point the global vault to a new one and leaves the old one untouched", async () => {
  const world = await configuredWorld({})
  const { globalVault, root } = world.folders
  await writeFile(join(globalVault, "keep.md"), bytes)
  const before = (await readdir(globalVault)).sort()
  const newVault = join(root, "New vault")
  const turn = await settingsScreen(world, [
    pickLine("Global vault:"),
    modeStep({ option: SETUP_CREATE_OPTION }),
    vaultStep(SETUP_KEEP_VAULT_TITLE, { value: newVault }),
    leaveScreen,
  ])
  expect(await realpath((await storedConfig(world)).global.vault)).toBe(await realpath(newVault))
  expect((await readdir(globalVault)).sort()).toEqual(before)
  expect(await readFile(join(globalVault, "keep.md"))).toEqual(bytes)
  expect((await readdir(newVault)).sort()).toEqual(["Memory.base", "_templates"])
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["warning", "info"])
  expect(turn.notifications[0]?.message.startsWith(DISCLOSURE_TITLE)).toBe(true)
  expect(turn.notifications[1]?.message.startsWith(SETUP_DONE)).toBe(true)
  expect(turn.notifications[1]?.message.endsWith(RELOAD_NOTE)).toBe(true)
  expect(world.pi.unexpected).toEqual([])
})

test("the attach option is still offered first when a vault is already configured", async () => {
  const world = await configuredWorld({})
  const before = await configText(world)
  const turn = await settingsScreen(world, [pickLine("Global vault:"), modeStep(pressEscape), leaveScreen])
  expect(optionsOf(world, SETUP_MODE_TITLE)).toEqual([SETUP_ATTACH_OPTION, SETUP_CREATE_OPTION])
  expect(turn.notifications.map((notice) => notice.message)).toEqual([SETUP_CANCELLED])
  expect(await configText(world)).toBe(before)
  expect(world.pi.unexpected).toEqual([])
})

test("a vault inside a registered project vault is refused from the screen and the config stays as it was", async () => {
  const world = await configuredWorld({})
  const before = await configText(world)
  const inner = join(world.folders.projectVault, "inner")
  const turn = await settingsScreen(world, [
    pickLine("Global vault:"),
    modeStep({ option: SETUP_CREATE_OPTION }),
    vaultStep(SETUP_KEEP_VAULT_TITLE, { value: inner }),
    leaveScreen,
  ])
  expect(
    turn.notifications.map((notice) => [
      notice.notifyType,
      notice.message.includes("vaults must not be equal or nested"),
    ]),
  ).toEqual([["error", true]])
  expect(await configText(world)).toBe(before)
  await expect(readdir(inner)).rejects.toMatchObject({ code: "ENOENT" })
  expect(world.pi.unexpected).toEqual([])
})
