export type { VaultAccessRequest } from "#src/services"

import type { PathIdentity, VaultAccessRequest } from "#src/services"
import type { Done, Failed } from "#src/shared"

export interface CheckVaultAccessInput {
  configPath: string
  cwd: string
  home: string
  request: VaultAccessRequest
}

export interface VaultAccessRefusal extends Failed {
  reason: "vault-access"
}

export type CheckVaultAccessResult = Done | VaultAccessRefusal

export interface GuardedTargets {
  roots: string[]
  identities: PathIdentity[]
}

export interface TargetCheck {
  request: VaultAccessRequest
  cwd: string
  home: string
  targets: GuardedTargets
}
