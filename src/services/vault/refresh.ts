import type { NamedVaultContext } from "#src/services/vault/context"
import { alwaysContinue, refreshFolders } from "./refresh-folders.ts"
import type { RefreshResult } from "./types.ts"

export async function refreshIndexes(vault: NamedVaultContext, folder: string): Promise<RefreshResult> {
  return refreshFolders(vault, [folder], alwaysContinue)
}
