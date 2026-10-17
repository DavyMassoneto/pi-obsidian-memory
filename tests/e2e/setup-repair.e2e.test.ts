import { readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  DISCLOSURE_TITLE,
  JEV_DISCLOSURE,
  MEMORY_SETUP_COMMAND,
  REMOTE_EMBEDDINGS_DISCLOSURE,
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
  DialogRequestSchema,
  dialogsTitled,
  firstSetupSteps,
  modeStep,
  noMemoryWorld,
  notifiedWith,
  notifySettles,
  optionsOf,
  pressEscape,
  recordsOf,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])
const LAYA = {
  provider: "laya",
  endpoint: "http://127.0.0.1:8000/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
}

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

test.each([
  { chosen: "Jev", settings: {}, shown: JEV_DISCLOSURE, hidden: REMOTE_EMBEDDINGS_DISCLOSURE },
  {
    chosen: "a remote embeddings provider",
    settings: { embeddings: { provider: "openai", model: "text-embedding-3-small" }, decisionModel: LAYA },
    shown: REMOTE_EMBEDDINGS_DISCLOSURE,
    hidden: JEV_DISCLOSURE,
  },
])("a repaired config that keeps $chosen shows its warning, and only its warning", async (kept) => {
  const world = await configuredWorld({})
  const config = await storedConfig(world)
  await writeFile(
    world.folders.configPath,
    JSON.stringify({ ...config, ...kept.settings, limits: { maxBodyChars: -1 } }),
  )
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
  const warning = turn.notifications.find((notice) => notice.message.startsWith(DISCLOSURE_TITLE))
  expect(warning?.notifyType).toBe("warning")
  expect(warning?.message).toContain(kept.shown)
  expect(warning?.message).not.toContain(kept.hidden)
  expect(recordsOf(DialogRequestSchema, world.pi.lines).filter((dialog) => dialog.method === "confirm")).toHaveLength(1)
  expect(world.pi.unexpected).toEqual([])
})
