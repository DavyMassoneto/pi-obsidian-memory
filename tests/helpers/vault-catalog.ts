import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import {
  analyzeVaultNote,
  type InspectedVaultFile,
  type VaultCatalogEntry,
  type VaultCatalogFailure,
} from "#src/domain"
import type { VaultContext } from "#src/services"
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

export function anInspectedFile(text: string, archived: boolean): InspectedVaultFile {
  return {
    path: "tools/Use pnpm.md",
    canonicalPath: "tools/Use pnpm.md",
    text,
    rawHash: "raw-two",
    stat: { size: 200, mtimeMs: 2000, ctimeMs: 3000, device: 1, inode: 2 },
    archived,
    analysis: analyzeVaultNote({ statement: "Use pnpm", text, archived, limits: aLimits() }),
  }
}

export function aCatalogFailure(
  reason: VaultCatalogFailure["reason"],
  scope: VaultCatalogFailure["scope"],
): VaultCatalogFailure {
  return { succeeded: false, problems: ["problem one"], path: "alias", scope, reason }
}

export function aVaultCatalogEntry(size: number, mtimeMs: number): VaultCatalogEntry {
  return {
    path: "tools/Old.md",
    kind: "note",
    archived: false,
    stat: { size, mtimeMs, ctimeMs: 1, device: 1, inode: 1 },
  }
}
