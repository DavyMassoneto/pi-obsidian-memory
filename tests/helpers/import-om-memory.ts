import type { OmSource } from "#src/services"
import { writeConfig } from "./config.ts"
import { setupVaults } from "./memory.ts"
import { operationContextFor } from "./operation-context.ts"

export const OM_IMPORT_CHUNK_TOKENS = 20

export async function omImportFixture() {
  const vaults = await setupVaults()
  const config = { ...vaults.config, observer: { ...vaults.config.observer, chunkTokens: OM_IMPORT_CHUNK_TOKENS } }
  const configPath = await writeConfig(vaults.root, config)
  const context = operationContextFor({ configPath, workingFolder: vaults.projectFolder })
  return { ...vaults, config, configPath, context }
}

export function aLongOmTopic(path: string): OmSource {
  const lines: string[] = []
  for (let line = 1; line <= 12; line++) lines.push(`Rule number ${line}: keep the KVM firmware pinned.`)
  return { path, text: lines.join("\r\n") }
}
