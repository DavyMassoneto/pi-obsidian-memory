import { writeFile } from "node:fs/promises"

import {
  INIT_CANCELLED,
  INIT_DONE,
  INIT_NAME_TITLE,
  INIT_VAULT_TITLE,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_OBSERVER_MODEL_TITLE,
  SETUP_VAULT_TITLE,
} from "#src/pi"
import { readConfig } from "#src/services"
import { E2E_MODEL, E2E_PROJECT_NAME, E2E_PROVIDER } from "./e2e-paths.ts"
import { notifySettles, type RpcTurn } from "./e2e-records.ts"
import type { RpcPi } from "./e2e-rpc.ts"
import type { CycleOverrides, WorldOptions } from "./e2e-world-types.ts"
import { testPlatform } from "./test-platform.ts"

export interface VaultFolders {
  globalVault: string
  projectVault: string
}

export interface ConfigurableFolders extends VaultFolders {
  configPath: string
}

export interface ConfigurableWorld {
  folders: ConfigurableFolders
  pi: RpcPi
  restart(): Promise<void>
}

export async function configureMemory(world: ConfigurableWorld, options: Pick<WorldOptions, "cycle">): Promise<void> {
  const model = `${E2E_PROVIDER}/${E2E_MODEL}`
  const { globalVault, projectVault } = world.folders
  const setup = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETUP_OBSERVER_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_AGENT_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_MODE_TITLE, answer: { option: SETUP_ATTACH_OPTION } },
      { method: "input", title: SETUP_VAULT_TITLE, answer: { value: globalVault } },
    ],
    notifySettles([SETUP_DONE, SETUP_CANCELLED]),
  )
  refuseFailures("setup", world, setup)
  const init = await world.pi.command(
    `/${MEMORY_INIT_COMMAND}`,
    [
      { method: "input", title: INIT_NAME_TITLE, answer: { value: E2E_PROJECT_NAME } },
      { method: "input", title: INIT_VAULT_TITLE, answer: { value: projectVault } },
    ],
    notifySettles([INIT_DONE, INIT_CANCELLED]),
  )
  refuseFailures("init", world, init)
  if (options.cycle) await overrideCycleSettings(world.folders.configPath, options.cycle)
  await world.restart()
}

async function overrideCycleSettings(configPath: string, overrides: CycleOverrides): Promise<void> {
  const config = await readConfig(configPath, testPlatform())
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  const observer = { ...config.output.observer, ...overrides.observer }
  const compaction = { ...config.output.compaction, ...overrides.compaction }
  await writeFile(configPath, JSON.stringify({ ...config.output, observer, compaction }))
}

function refuseFailures(step: string, world: ConfigurableWorld, turn: RpcTurn): void {
  const errors = turn.notifications.filter((notice) => notice.notifyType === "error").map((notice) => notice.message)
  if (world.pi.unexpected.length === 0 && errors.length === 0) return
  throw new Error(
    `${step}: unexpected dialogs ${JSON.stringify(world.pi.unexpected)}; errors ${JSON.stringify(errors)}`,
  )
}
