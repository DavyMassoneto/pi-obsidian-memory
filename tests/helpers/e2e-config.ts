import { readFile, writeFile } from "node:fs/promises"

import { DONE_LABEL, MEMORY_SETUP_COMMAND, NO_MEMORY_NOTICE, SETTINGS_TITLE, STATUS_LOADING } from "#src/pi"
import { type MemoryConfig, readConfig } from "#src/services"
import type { UiStep } from "./e2e-protocol.ts"
import {
  type AvailableModel,
  type DialogRequest,
  DialogRequestSchema,
  type Notify,
  notifySettles,
  type RpcTurn,
  recordsOf,
} from "./e2e-records.ts"
import { E2E_MODEL_LABEL } from "./e2e-setup-steps.ts"
import { dialogTitled, statusCleared } from "./e2e-turns.ts"
import { type E2eWorld, e2eWorld } from "./e2e-world.ts"
import type { WorldOptions } from "./e2e-world-types.ts"

export async function storedConfig(world: E2eWorld): Promise<MemoryConfig> {
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  return config.output
}

export async function rewriteConfig(world: E2eWorld, edit: Partial<MemoryConfig>): Promise<string> {
  const text = JSON.stringify({ ...(await storedConfig(world)), ...edit })
  await writeFile(world.folders.configPath, text)
  return text
}

export function configText(world: E2eWorld): Promise<string> {
  return readFile(world.folders.configPath, "utf8")
}

export function settingsScreen(world: E2eWorld, steps: UiStep[]): Promise<RpcTurn> {
  return world.pi.command(`/${MEMORY_SETUP_COMMAND}`, steps, dialogTitled(SETTINGS_TITLE))
}

export function pickLine(label: string): UiStep {
  return { method: "select", title: SETTINGS_TITLE, answer: { option: label } }
}

export const leaveScreen: UiStep = { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } }

export function dialogsTitled(world: E2eWorld, title: string): DialogRequest[] {
  return recordsOf(DialogRequestSchema, world.pi.lines).filter((dialog) => dialog.title.includes(title))
}

export async function noMemoryWorld(options: Partial<WorldOptions>): Promise<E2eWorld> {
  const world = await e2eWorld({
    memory: "none",
    tools: [],
    modelCache: "shared",
    capture: "after-each-turn",
    ...options,
  })
  await world.pi.waitFor(notifySettles([NO_MEMORY_NOTICE]), 0)
  return world
}

export async function configuredWorld(options: Partial<WorldOptions>): Promise<E2eWorld> {
  const world = await e2eWorld({
    memory: "configured",
    tools: [],
    modelCache: "shared",
    capture: "after-each-turn",
    ...options,
  })
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
  return world
}

export function modelRef(model: AvailableModel): string {
  return `${model.provider}/${model.id}`
}

export async function anotherModel(world: E2eWorld): Promise<AvailableModel> {
  const other = (await world.pi.availableModels()).find((model) => modelRef(model) !== E2E_MODEL_LABEL)
  if (!other) throw new Error("pi lists no model besides the E2E one")
  return other
}

export async function onlyProject(world: E2eWorld): Promise<MemoryConfig["projects"][number]> {
  const [project] = (await storedConfig(world)).projects
  if (!project) throw new Error("no project is registered")
  return project
}

export function onlyNotice(turn: RpcTurn): Notify {
  const [notice, ...rest] = turn.notifications
  if (!notice || rest.length > 0) throw new Error(`expected one notice, got ${JSON.stringify(turn.notifications)}`)
  return notice
}

export function optionsOf(world: E2eWorld, title: string): string[] {
  const [dialog] = dialogsTitled(world, title)
  if (!dialog?.options) throw new Error(`no dialog with options titled "${title}"`)
  return dialog.options
}
