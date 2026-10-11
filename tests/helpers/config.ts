import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { MemoryConfig } from "#/domain"
import { aLimits } from "./limits.ts"
import type { LimitsInput } from "./types.ts"

export function aConfig(): MemoryConfig {
  return {
    global: { vault: "C:/Users/Administrator/OneDrive/Obisidian/Global memory" },
    projects: [
      { name: "loja", folder: "D:/Projects/loja", vault: "C:/vaults/loja" },
      { name: "loja-admin", folder: "D:/Projects/loja/admin", vault: "C:/vaults/loja-admin" },
    ],
    limits: aLimits(),
  }
}

export function memoryConfigAt(root: string): MemoryConfig {
  return {
    global: { vault: join(root, "Global memory") },
    projects: [{ name: "loja", folder: join(root, "work", "loja"), vault: join(root, "loja") }],
    limits: aLimits(),
  }
}

export async function writeConfig(folder: string, config: MemoryConfig): Promise<string> {
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify(config, null, 2))
  return path
}

export function configTextWithLimits(limits: LimitsInput): string {
  return JSON.stringify({ ...aConfig(), limits })
}
