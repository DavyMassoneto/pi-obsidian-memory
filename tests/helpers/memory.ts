import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"

import { memoryConfigPath } from "#/pi"
import { memoryConfigAt, writeConfig } from "./config.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function setupVaults() {
  const root = await useTempFolder()
  const globalVault = join(root, "Global memory")
  const projectVault = join(root, "loja")
  const config = memoryConfigAt(root)
  const projectFolder = join(root, "work", "loja")
  const unregisteredFolder = join(root, "work", "unregistered")

  await mkdir(globalVault)
  await mkdir(projectVault)
  await mkdir(join(projectFolder, "src"), { recursive: true })
  await mkdir(unregisteredFolder)
  const configPath = await writeConfig(root, config)

  return { root, globalVault, projectVault, configPath, config, projectFolder, unregisteredFolder }
}

export async function setupRegisteredMemoryAdd() {
  const vaults = await setupVaults()
  const configPath = memoryConfigPath(vaults.root)
  await mkdir(dirname(configPath))
  await copyFile(vaults.configPath, configPath)
  return { ...vaults, configPath, agentDir: vaults.root }
}
