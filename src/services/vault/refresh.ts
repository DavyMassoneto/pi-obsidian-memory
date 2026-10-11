import { refreshFolders } from "./refresh-folders.ts"
import type { NamedVaultContext, RefreshResult } from "./types.ts"

export async function refreshIndexes(vault: NamedVaultContext, folder: string): Promise<RefreshResult> {
  return refreshFolders(vault, [folder])
}
