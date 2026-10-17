import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderVaultAssets } from "#src/domain"
import {
  CHAT_MODELS_DISCLOSURE,
  DISCLOSURE_TITLE,
  JEV_DISCLOSURE,
  MEMORY_SETUP_COMMAND,
  RELOAD_NOTE,
  SETUP_CANCELLED,
  SETUP_CREATE_OPTION,
  SETUP_DONE,
  SETUP_NO_MODEL,
  SETUP_VAULT_TITLE,
} from "#src/pi"
import {
  agentModelStep,
  captureModelStep,
  chooseE2eModel,
  dialogTitled,
  ExtensionErrorSchema,
  fileExists,
  firstSetupSteps,
  modeStep,
  noMemoryWorld,
  notifySettles,
  pressEscape,
  recordsOf,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])
const disclosure = [DISCLOSURE_TITLE, CHAT_MODELS_DISCLOSURE, JEV_DISCLOSURE].join("\n")

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

test("the first-setup disclosure is one plain warning that names chat models and Jev, and asks nothing", async () => {
  const world = await noMemoryWorld({})
  const vault = join(world.folders.root, "created-vault")
  const turn = await world.pi.command(`/${MEMORY_SETUP_COMMAND}`, firstSetupSteps(SETUP_CREATE_OPTION, vault), settles)
  expect(
    turn.notifications.filter((notice) => notice.notifyType === "warning").map((notice) => notice.message),
  ).toEqual([disclosure])
  expect(world.pi.unexpected).toEqual([])
})

test("cancelling the mode question writes nothing", async () => {
  const world = await noMemoryWorld({})
  const before = await readdir(world.folders.root)
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [captureModelStep(pressEscape), agentModelStep(chooseE2eModel), modeStep(pressEscape)],
    settles,
  )
  expect(turn.notifications.map((notice) => notice.message)).toEqual([SETUP_CANCELLED])
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(await readdir(world.folders.root)).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})

test("cancelling the vault question writes nothing", async () => {
  const world = await noMemoryWorld({})
  const before = await readdir(world.folders.root)
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      captureModelStep(chooseE2eModel),
      agentModelStep(chooseE2eModel),
      modeStep({ option: SETUP_CREATE_OPTION }),
      vaultStep(SETUP_VAULT_TITLE, pressEscape),
    ],
    settles,
  )
  expect(turn.notifications.map((notice) => notice.message)).toEqual([SETUP_CANCELLED])
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(await readdir(world.folders.root)).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})

test("on a first run with no model available, setup is refused before it asks anything", async () => {
  const world = await noMemoryWorld({ credentials: "none" })
  expect(await world.pi.availableModels()).toEqual([])
  const turn = await world.pi.command(`/${MEMORY_SETUP_COMMAND}`, [], settles)
  expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([[SETUP_NO_MODEL, "error"]])
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(world.pi.unexpected).toEqual([])
})

test("creating over a folder that already has files is refused, and nothing changes", async () => {
  const world = await noMemoryWorld({})
  const { globalVault } = world.folders
  await writeFile(join(globalVault, "mine.md"), "x")
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    firstSetupSteps(SETUP_CREATE_OPTION, globalVault),
    settles,
  )
  expect(turn.notifications).toHaveLength(1)
  expect(turn.notifications[0]?.notifyType).toBe("error")
  expect(turn.notifications[0]?.message).toContain("attach")
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(await readdir(globalVault)).toEqual(["mine.md"])
  expect(world.pi.unexpected).toEqual([])
})

test("stopping pi while the vault question is open raises no extension error", async () => {
  const world = await noMemoryWorld({})
  await world.pi.beginCommand(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      captureModelStep(chooseE2eModel),
      agentModelStep(chooseE2eModel),
      modeStep({ option: SETUP_CREATE_OPTION }),
      vaultStep(SETUP_VAULT_TITLE, { open: true }),
    ],
    dialogTitled(SETUP_VAULT_TITLE),
  )
  await world.stop()
  expect(recordsOf(ExtensionErrorSchema, world.pi.lines)).toEqual([])
  expect(world.pi.unexpected).toEqual([])
})
