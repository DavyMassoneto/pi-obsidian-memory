export type { VaultAccessRequest } from "#src/services"

import type { PathIdentity, PathPlatform, VaultAccessRequest } from "#src/services"
import type { Done, Failed } from "#src/shared"

export type { PathPlatform } from "#src/services"

export interface CheckVaultAccessInput {
  configPath: string
  cwd: string
  home: string
  platform: PathPlatform
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
  platform: PathPlatform
  targets: GuardedTargets
}
