import type { NoteLimits } from "#src/domain"

export interface VaultContext {
  path: string
  limits: NoteLimits
}

export interface NamedVaultContext extends VaultContext {
  name: string
}
