import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { MemoryConfig } from "#/domain/config"

export function aConfig(): MemoryConfig {
  return {
    global: { vault: "C:/Users/Administrator/OneDrive/Obisidian/Global memory" },
    projects: [
      { name: "loja", folder: "D:/Projects/loja", vault: "C:/vaults/loja" },
      { name: "loja-admin", folder: "D:/Projects/loja/admin", vault: "C:/vaults/loja-admin" },
    ],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
}

export async function writeConfig(folder: string, config: MemoryConfig): Promise<string> {
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify(config, null, 2))
  return path
}
