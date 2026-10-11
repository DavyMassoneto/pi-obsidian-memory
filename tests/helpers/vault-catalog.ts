import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import type { VaultContext } from "#/services"
import { aLimits } from "./limits.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function catalogVault(): Promise<VaultContext> {
  return { path: await useTempFolder(), limits: aLimits() }
}

export async function putCatalogFile(vault: VaultContext, path: string, content: string | Uint8Array): Promise<void> {
  const destination = join(vault.path, path)
  await mkdir(dirname(destination), { recursive: true })
  await writeFile(destination, content)
}
