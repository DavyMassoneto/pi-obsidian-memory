import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { memoryConfigPath } from "#src/pi"
import { registerFakePiAt } from "./pi.ts"
import { productSettings } from "./settings.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function piRegistrationFixture() {
  const root = await useTempFolder()
  const agentDir = join(root, "agent")
  const configPath = memoryConfigPath(agentDir)
  const workingFolder = join(root, "work", "loja")
  await mkdir(workingFolder, { recursive: true })
  const pi = registerFakePiAt(agentDir, {})
  const globalVault = join(root, "Global memory")
  const config = { global: { vault: globalVault }, projects: [], ...productSettings() }
  return { root, agentDir, configPath, workingFolder, globalVault, config, pi }
}

export async function writeAgentConfig(configPath: string, text: string): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, text)
}
