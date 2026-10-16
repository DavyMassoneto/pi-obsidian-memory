import { isInside } from "#src/domain/config"

export function vaultContaining(path: string, vaults: string[]): string | null {
  for (const vault of vaults) {
    if (isInside(path, vault)) {
      return vault
    }
  }

  return null
}

export function vaultBelow(path: string, vaults: string[]): string | null {
  for (const vault of vaults) {
    if (isInside(vault, path)) {
      return vault
    }
  }

  return null
}
