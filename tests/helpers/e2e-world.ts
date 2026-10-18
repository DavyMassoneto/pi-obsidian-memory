import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { onTestFinished } from "vitest"

import { memoryConfigPath, memoryModelCachePath } from "#src/pi"
import { anthropicAuthExtensionPaths, anthropicAuthPackageFolder } from "./e2e-anthropic-auth.ts"
import { type PiCredentialsEnv, piCredentialsEnv } from "./e2e-credentials.ts"
import { E2E_MODEL, E2E_PROVIDER, extensionPath, repoRoot, skillsPath } from "./e2e-paths.ts"
import { RpcPi } from "./e2e-rpc.ts"
import { configureMemory } from "./e2e-world-setup.ts"
import type { AgentSettings, WorldFolders, WorldOptions } from "./e2e-world-types.ts"
import { benchmarkCacheFolder } from "./embedding-benchmark.ts"

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

  get options(): WorldOptions {
    return this.#options
  }

  get memory(): WorldOptions["memory"] {
    return this.#options.memory
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
  const settings = await agentSettings(options)
  if (Object.keys(settings).length > 0)
    await writeFile(join(folders.agentDir, "settings.json"), JSON.stringify(settings))
  let world: E2eWorld | null = null
  onTestFinished(async ({ task }) => {
    try {
      if (task.result?.state === "fail" && world) console.error(world.pi.diagnostics)
      await world?.stop()
    } finally {
      await rm(folders.root, { recursive: true, force: true })
    }
  })
  if (options.modelCache === "shared") await shareModelCache(folders.agentDir)
  if (options.startIn === "subfolder") await mkdir(folders.startFolder)
  world = new E2eWorld(folders, options, await startPi(folders, options))
  if (options.memory === "configured") await configureMemory(world, options)
  return world
}

async function agentSettings(options: WorldOptions): Promise<AgentSettings> {
  const settings: AgentSettings = {}
  if ("installed" in options) settings.packages = [repoRoot, await anthropicAuthPackageFolder()]
  if ("compactsSmallSessions" in options) settings.compaction = { keepRecentTokens: 1 }
  return settings
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
  return { ...folders, startFolder: join(folders.cwd, "src"), configPath: memoryConfigPath(folders.agentDir) }
}

async function shareModelCache(agentDir: string): Promise<void> {
  const link = memoryModelCachePath(agentDir)
  await mkdir(dirname(link), { recursive: true })
  await mkdir(benchmarkCacheFolder(), { recursive: true })
  await symlink(benchmarkCacheFolder(), link, "junction")
}

async function startPi(folders: WorldFolders, options: WorldOptions): Promise<RpcPi> {
  let credentials: PiCredentialsEnv | null = null
  if (options.credentials !== "none") credentials = await piCredentialsEnv()
  let authExtensions: string[] = []
  if (!("installed" in options)) authExtensions = await anthropicAuthExtensionPaths()
  return new RpcPi({
    cwd: startFolderOf(folders, options),
    agentDir: folders.agentDir,
    args: piArgs(options, authExtensions),
    credentials,
    omitTypesafeKey: "withoutTypesafeKey" in options,
    offlineNpmCache: offlineNpmCacheOf(folders, options),
  })
}

function offlineNpmCacheOf(folders: WorldFolders, options: WorldOptions): string | null {
  if (options.offlineNpm) return join(folders.root, "npm-cache")
  return null
}

function startFolderOf(folders: WorldFolders, options: WorldOptions): string {
  if (options.startIn === "subfolder") return folders.startFolder
  return folders.cwd
}

export function piArgs(options: WorldOptions, authExtensions: string[]): string[] {
  const args = ["--provider", E2E_PROVIDER, "--model", E2E_MODEL]
  if (options.session !== "saved") args.unshift("--no-session")
  if (!("installed" in options)) args.push("-ne", "-e", extensionPath())
  for (const authExtension of authExtensions) args.push("-e", authExtension)
  if (!("installed" in options)) args.push("-ns", "--skill", skillsPath())
  args.push("-np", "--no-themes", "-nc", "--no-mcp", "-na")
  if (options.tools.length > 0) args.push("--tools", options.tools.map((tool) => `+${tool}`).join(","))
  return args
}
