import type { NoteLimits } from "#/domain"

export interface VaultContext {
  path: string
  limits: NoteLimits
}

export interface NamedVaultContext extends VaultContext {
  name: string
}
