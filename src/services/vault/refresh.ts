import type { NoteLimits } from "#/domain"
import { refreshFolders } from "./refresh-folders.ts"
import type { RefreshResult } from "./types.ts"

export async function refreshIndexes(
  vault: string,
  folder: string,
  vaultName: string,
  limits: NoteLimits,
): Promise<RefreshResult> {
  return refreshFolders({ path: vault, name: vaultName, limits }, [folder])
}
