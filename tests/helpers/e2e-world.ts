import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { onTestFinished } from "vitest"

import {
  INIT_CANCELLED,
  INIT_DONE,
  INIT_NAME_TITLE,
  INIT_VAULT_TITLE,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  memoryConfigPath,
  memoryModelCachePath,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CAPTURE_MODEL_TITLE,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_VAULT_TITLE,
} from "#src/pi"
import { anthropicAuthExtensionPaths } from "./e2e-anthropic-auth.ts"
import { piCredentialsEnv } from "./e2e-credentials.ts"
import { E2E_MODEL, E2E_PROJECT_NAME, E2E_PROVIDER, extensionPath, skillsPath } from "./e2e-paths.ts"
import { notifySettles, type RpcTurn } from "./e2e-records.ts"
import { RpcPi } from "./e2e-rpc.ts"
import { benchmarkCacheFolder } from "./embedding-benchmark.ts"

export interface WorldOptions {
  memory: "none" | "configured"
  tools: string[]
  modelCache: "fresh" | "shared"
}

export interface WorldFolders {
  root: string
  agentDir: string
  cwd: string
  globalVault: string
  projectVault: string
  configPath: string
}

export class E2eWorld {
  readonly folders: WorldFolders
  #options: WorldOptions
  #pi: RpcPi

  constructor(folders: WorldFolders, options: WorldOptions, pi: RpcPi) {
    this.folders = folders
    this.#options = options
    this.#pi = pi
  }

  get pi(): RpcPi {
    return this.#pi
  }

  async restart(): Promise<void> {
    await this.#pi.stop()
    this.#pi = await startPi(this.folders, this.#options)
  }

  stop(): Promise<void> {
    return this.#pi.stop()
  }
}

export async function e2eWorld(options: WorldOptions): Promise<E2eWorld> {
  const folders = await worldFolders()
  let world: E2eWorld | null = null
  onTestFinished(async () => {
    try {
      await world?.stop()
    } finally {
      await rm(folders.root, { recursive: true, force: true })
    }
  })
  if (options.modelCache === "shared") await shareModelCache(folders.agentDir)
  world = new E2eWorld(folders, options, await startPi(folders, options))
  if (options.memory === "configured") await configureMemory(world)
  return world
}

async function worldFolders(): Promise<WorldFolders> {
  const root = await mkdtemp(join(tmpdir(), "pi-memory-e2e-"))
  const folders = {
    root,
    agentDir: join(root, "agent"),
    cwd: join(root, "project"),
    globalVault: join(root, "global-vault"),
    projectVault: join(root, "project-vault"),
  }
  for (const folder of [folders.agentDir, folders.cwd, folders.globalVault, folders.projectVault]) await mkdir(folder)
  return { ...folders, configPath: memoryConfigPath(folders.agentDir) }
}

async function shareModelCache(agentDir: string): Promise<void> {
  const link = memoryModelCachePath(agentDir)
  await mkdir(dirname(link), { recursive: true })
  await mkdir(benchmarkCacheFolder(), { recursive: true })
  await symlink(benchmarkCacheFolder(), link, "junction")
}

async function startPi(folders: WorldFolders, options: WorldOptions): Promise<RpcPi> {
  const credentials = await piCredentialsEnv()
  const authExtensions = await anthropicAuthExtensionPaths()
  return new RpcPi({
    cwd: folders.cwd,
    agentDir: folders.agentDir,
    args: piArgs(options.tools, authExtensions),
    credentials,
  })
}

function piArgs(tools: string[], authExtensions: string[]): string[] {
  const args = ["--no-session", "--provider", E2E_PROVIDER, "--model", E2E_MODEL, "-ne", "-e", extensionPath()]
  for (const authExtension of authExtensions) args.push("-e", authExtension)
  args.push("-ns", "--skill", skillsPath(), "-np", "--no-themes", "-nc", "--no-mcp", "-na")
  if (tools.length > 0) args.push("--tools", tools.map((tool) => `+${tool}`).join(","))
  return args
}

async function configureMemory(world: E2eWorld): Promise<void> {
  const model = `${E2E_PROVIDER}/${E2E_MODEL}`
  const { globalVault, projectVault } = world.folders
  const setup = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETUP_CAPTURE_MODEL_TITLE, answer: { option: model } },
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
  await world.restart()
}

function refuseFailures(step: string, world: E2eWorld, turn: RpcTurn): void {
  const errors = turn.notifications.filter((notice) => notice.notifyType === "error").map((notice) => notice.message)
  if (world.pi.unexpected.length === 0 && errors.length === 0) return
  throw new Error(
    `${step}: unexpected dialogs ${JSON.stringify(world.pi.unexpected)}; errors ${JSON.stringify(errors)}`,
  )
}
