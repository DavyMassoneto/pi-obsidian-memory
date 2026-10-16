export type { VaultAccessRequest } from "#src/services"

import type { PathIdentity, VaultAccessRequest } from "#src/services"
import type { Done, Failed } from "#src/shared"

export interface ConfigWriteRequest {
  kind: "config-write"
  path: string
}

export type GuardRequest = VaultAccessRequest | ConfigWriteRequest

export interface CheckVaultAccessInput {
  configPath: string
  dataFolder: string
  cwd: string
  home: string
  request: GuardRequest
}

export interface VaultAccessRefusal extends Failed {
  reason: "vault-access" | "config-protected"
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
