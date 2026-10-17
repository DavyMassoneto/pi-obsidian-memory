import { readdir } from "node:fs/promises"

import { expect, test } from "vitest"

import {
  IN_USE_MARK,
  MEMORY_SETUP_COMMAND,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CAPTURE_MODEL_TITLE,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_VAULT_TITLE,
} from "#src/pi"
import {
  agentModelStep,
  anotherModel,
  captureModelStep,
  chooseE2eModel,
  dialogsTitled,
  E2E_MODEL,
  E2E_MODEL_LABEL,
  E2E_PROVIDER,
  fileExists,
  inputPrices,
  modelRef,
  modeStep,
  noMemoryWorld,
  notifySettles,
  optionsOf,
  pressEscape,
  storedConfig,
  vaultStep,
} from "#test-helpers"

const settles = notifySettles([SETUP_DONE, SETUP_CANCELLED])
const e2eReference = { provider: E2E_PROVIDER, id: E2E_MODEL }

test("on a first run the capture list starts with the model in use and the agent list is sorted by price, and the chosen models are written", async () => {
  const world = await noMemoryWorld({})
  const models = await world.pi.availableModels()
  const other = await anotherModel(world)
  await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      captureModelStep({ option: modelRef(other) }),
      agentModelStep(chooseE2eModel),
      modeStep({ option: SETUP_ATTACH_OPTION }),
      vaultStep(SETUP_VAULT_TITLE, { value: world.folders.globalVault }),
    ],
    settles,
  )
  const captureOptions = optionsOf(world, SETUP_CAPTURE_MODEL_TITLE)
  const agentOptions = optionsOf(world, SETUP_AGENT_MODEL_TITLE)
  expect(captureOptions[0]?.startsWith(`${E2E_MODEL_LABEL} ${IN_USE_MARK}`)).toBe(true)
  const othersPrices = inputPrices(captureOptions.slice(1), models)
  expect(othersPrices).toEqual([...othersPrices].sort((left, right) => left - right))
  expect(captureOptions).toHaveLength(models.length)
  const agentPrices = inputPrices(agentOptions, models)
  expect(agentPrices).toEqual([...agentPrices].sort((left, right) => left - right))
  expect(agentOptions).toHaveLength(models.length)
  const config = await storedConfig(world)
  expect(config.capture.model).toEqual({ provider: other.provider, id: other.id })
  expect(config.memoryAgent.model).toEqual(e2eReference)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  { how: "Escape", answer: pressEscape },
  { how: "an empty answer", answer: { value: "" } },
])(
  "with $how on the capture list the model in use is the capture default, and the agent must still be chosen",
  async ({ answer }) => {
    const world = await noMemoryWorld({})
    const other = await anotherModel(world)
    await world.pi.command(
      `/${MEMORY_SETUP_COMMAND}`,
      [
        captureModelStep(answer),
        agentModelStep({ option: modelRef(other) }),
        modeStep({ option: SETUP_ATTACH_OPTION }),
        vaultStep(SETUP_VAULT_TITLE, { value: world.folders.globalVault }),
      ],
      settles,
    )
    const config = await storedConfig(world)
    expect(config.capture.model).toEqual(e2eReference)
    expect(config.memoryAgent.model).toEqual({ provider: other.provider, id: other.id })
    expect(world.pi.unexpected).toEqual([])
  },
)

test.each([
  { how: "Escape", answer: pressEscape },
  { how: "an empty answer", answer: { value: "" } },
])(
  "the memory agent is never defaulted to pi's model: with $how on its list nothing is written",
  async ({ answer }) => {
    const world = await noMemoryWorld({})
    const before = await readdir(world.folders.root)
    const turn = await world.pi.command(
      `/${MEMORY_SETUP_COMMAND}`,
      [captureModelStep(pressEscape), agentModelStep(answer)],
      settles,
    )
    expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([[SETUP_CANCELLED, "info"]])
    expect(dialogsTitled(world, SETUP_MODE_TITLE)).toEqual([])
    expect(await fileExists(world.folders.configPath)).toBe(false)
    expect(await readdir(world.folders.root)).toEqual(before)
    expect(world.pi.unexpected).toEqual([])
  },
)
