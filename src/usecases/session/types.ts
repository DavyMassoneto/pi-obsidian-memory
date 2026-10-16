import type { InspectedVaultFile, MemoryScope, ParsedVaultNote } from "#src/services"

export interface SessionIdentity {
  readonly sessionId: string
  readonly branchId: string | null
}

export interface OperationStamp extends SessionIdentity {
  readonly generation: number
}

export interface MemoryAddress {
  vault: MemoryScope
  path: string
}

export interface DeliveredRead extends MemoryAddress, InspectedVaultFile {
  canonicalVault: string
  id: string | null
  sourceCallId: string
  analysis: ParsedVaultNote
}

export interface Lease {
  release(): void
}

export interface BoundConfiguration {
  bound: true
  hash: string
}

export interface UnboundConfiguration {
  bound: false
}

export type ConfigurationBinding = BoundConfiguration | UnboundConfiguration

export type CancelLeaseWaiter = () => void

export interface LeaseWaiter {
  signal: AbortSignal
  result: PromiseWithResolvers<Lease | null>
  cancel: CancelLeaseWaiter
}
