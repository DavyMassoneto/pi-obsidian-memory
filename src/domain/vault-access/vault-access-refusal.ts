import { absoluteCandidate } from "./absolute-candidate.ts"
import { commandMentionsVault } from "./command-mentions-vault.ts"
import type { PathAccessRequest, VaultAccessRequest } from "./types.ts"
import { vaultBelow, vaultContaining } from "./vault-location.ts"

export function vaultAccessRefusal(
  request: VaultAccessRequest,
  cwd: string,
  home: string,
  vaults: string[],
): string | null {
  if (request.kind === "command") {
    return commandMentionsVault(request.command, cwd, home, vaults)
  }

  return pathVaultHit(request, absoluteCandidate(request.path, cwd, home), vaults)
}

function pathVaultHit(request: PathAccessRequest, path: string, vaults: string[]): string | null {
  const containing = vaultContaining(path, vaults)
  if (containing) {
    return containing
  }
  if (request.kind === "tree") {
    return vaultBelow(path, vaults)
  }

  return null
}
