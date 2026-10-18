import type { PathPlatform } from "#src/domain/path-platform"
import { absoluteCandidate } from "./absolute-candidate.ts"
import { commandMentionsVault } from "./command-mentions-vault.ts"
import type { PathAccessRequest, VaultAccessRequest } from "./types.ts"
import { vaultBelow, vaultContaining } from "./vault-location.ts"

export function vaultAccessRefusal(
  request: VaultAccessRequest,
  cwd: string,
  home: string,
  vaults: string[],
  platform: PathPlatform,
): string | null {
  if (request.kind === "command") {
    return commandMentionsVault(request.command, cwd, home, vaults, platform)
  }

  return pathVaultHit(request, absoluteCandidate(request.path, cwd, home, platform), vaults, platform)
}

function pathVaultHit(
  request: PathAccessRequest,
  path: string,
  vaults: string[],
  platform: PathPlatform,
): string | null {
  const containing = vaultContaining(path, vaults, platform)
  if (containing) {
    return containing
  }
  if (request.kind === "tree") {
    return vaultBelow(path, vaults, platform)
  }

  return null
}
