import { isInside } from "#src/domain/config"
import type { PathPlatform } from "#src/domain/path-platform"

export function vaultContaining(path: string, vaults: string[], platform: PathPlatform): string | null {
  for (const vault of vaults) {
    if (isInside(path, vault, platform)) {
      return vault
    }
  }

  return null
}

export function vaultBelow(path: string, vaults: string[], platform: PathPlatform): string | null {
  for (const vault of vaults) {
    if (isInside(vault, path, platform)) {
      return vault
    }
  }

  return null
}
