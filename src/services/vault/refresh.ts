import type { NamedVaultContext } from "#src/services/vault/context"
import { alwaysContinue, refreshFolders } from "./refresh-folders.ts"
import type { RefreshResult } from "./types.ts"

export async function refreshIndexes(vault: NamedVaultContext, folder: string): Promise<RefreshResult> {
  const { refreshed: _refreshed, ...result } = await refreshFolders(vault, [folder], alwaysContinue, "with-ancestors")
  return result
}
