import { readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  MEMORY_SETUP_COMMAND,
  REPAIR_CONFIRM_LINE,
  REPAIR_TITLE,
  REPLACE_LINE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CREATE_OPTION,
  SETUP_DONE,
  SETUP_KEEP_VAULT_TITLE,
  SETUP_MODE_TITLE,
} from "#src/pi"
import {
  agentModelStep,
  captureModelStep,
  configuredWorld,
  dialogsTitled,
  firstSetupSteps,
  modeStep,
  noMemoryWorld,
  notifiedWith,
  notifySettles,
  optionsOf,
  pressEscape,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])

test("a config missing a key is repaired: valid settings stay, the missing key is added after confirmation", async () => {
  const world = await configuredWorld({})
  const { globalVault } = world.folders
  const config = await storedConfig(world)
  await writeFile(join(globalVault, "keep.md"), "old note")
  const customized = { ...config, limits: { ...config.limits, maxNotesPerFolder: 33 } }
  const { context, ...withoutContext } = customized
  await writeFile(world.folders.configPath, JSON.stringify(withoutContext))
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "confirm", title: REPAIR_TITLE, answer: { confirmed: true } },
      captureModelStep(pressEscape),
      agentModelStep(pressEscape),
      modeStep({ option: SETUP_ATTACH_OPTION }),
      vaultStep(SETUP_KEEP_VAULT_TITLE, { value: "" }),
    ],
    settles,
  )
  expect(await storedConfig(world)).toEqual(customized)
  expect(context).toEqual({ budgetChars: 12000 })
  expect(optionsOf(world, SETUP_MODE_TITLE)[0]).toBe(SETUP_ATTACH_OPTION)
  expect(dialogsTitled(world, SETUP_KEEP_VAULT_TITLE)[0]?.placeholder).toBe(config.global.vault)
  expect(dialogsTitled(world, REPAIR_TITLE)[0]?.message).toContain("context")
  expect(notifiedWith(turn, `${SETUP_DONE} ${config.global.vault}`)).toHaveLength(1)
  expect(await readFile(join(globalVault, "keep.md"), "utf8")).toBe("old note")
  expect(world.pi.unexpected).toEqual([])
})

test("a config that is not JSON is left as it was when the replacement is declined", async () => {
  const world = await noMemoryWorld({})
  await writeFile(world.folders.configPath, "{malformed")
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [{ method: "confirm", title: REPAIR_TITLE, answer: { confirmed: false } }],
    settles,
  )
  const [confirm] = dialogsTitled(world, REPAIR_TITLE)
  expect(confirm?.message).toContain(REPLACE_LINE)
  expect(confirm?.message?.endsWith(REPAIR_CONFIRM_LINE)).toBe(true)
  expect(await readFile(world.folders.configPath, "utf8")).toBe("{malformed")
  expect(turn.notifications.map((notice) => notice.message)).toEqual([SETUP_CANCELLED])
  expect(world.pi.unexpected).toEqual([])
})

test("a config that is not JSON is replaced when the replacement is accepted", async () => {
  const world = await noMemoryWorld({})
  await writeFile(world.folders.configPath, "{malformed")
  const vault = join(world.folders.root, "created-vault")
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "confirm", title: REPAIR_TITLE, answer: { confirmed: true } },
      ...firstSetupSteps(SETUP_CREATE_OPTION, vault),
    ],
    settles,
  )
  expect(await realpath((await storedConfig(world)).global.vault)).toBe(await realpath(vault))
  expect(notifiedWith(turn, SETUP_DONE)).toHaveLength(1)
  expect(world.pi.unexpected).toEqual([])
})
