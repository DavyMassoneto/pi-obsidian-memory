import { copyFile, mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"

import { memoryConfigPath } from "#/pi"
import { aConfig, writeConfig } from "./config.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function setupVaults() {
  const root = await useTempFolder()
  const globalVault = join(root, "Global memory")
  const projectVault = join(root, "loja")
  const config = {
    ...aConfig(),
    global: { vault: globalVault },
    projects: [{ name: "loja", folder: "D:/Projects/loja", vault: projectVault }],
  }
  await mkdir(globalVault)
  await mkdir(projectVault)
  const configPath = await writeConfig(root, config)
  return { root, globalVault, projectVault, configPath }
}

export async function setupRegisteredMemoryAdd() {
  const vaults = await setupVaults()
  const configPath = memoryConfigPath(vaults.root)
  await mkdir(dirname(configPath))
  await copyFile(vaults.configPath, configPath)
  return { ...vaults, configPath, agentDir: vaults.root }
}
