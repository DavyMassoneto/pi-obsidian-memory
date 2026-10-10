import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { aConfig, writeConfig } from "./config.ts"
import { useTempVault } from "./vault.ts"

export async function setupVaults() {
  const root = await useTempVault()
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

export async function setupMemoryAdd() {
  const root = await useTempVault()
  const config = {
    ...aConfig(),
    global: { vault: join(root, "Global memory") },
    projects: [],
  }
  await mkdir(config.global.vault)
  return { root, context: { configPath: await writeConfig(root, config), workingFolder: "D:/Downloads" } }
}
