import { SessionLeases } from "./lease.ts"
import { GetReceipts } from "./receipts.ts"
import type {
  ConfigurationBinding,
  DeliveredRead,
  Lease,
  MemoryAddress,
  OperationStamp,
  SessionIdentity,
} from "./types.ts"

export class MemorySession {
  #stamp: OperationStamp
  #controller = new AbortController()
  #aborted = false
  #configuration: ConfigurationBinding = { bound: false }
  #leases: SessionLeases
  #receipts = new GetReceipts()

  constructor(identity: SessionIdentity, leases?: SessionLeases) {
    this.#stamp = Object.freeze({ sessionId: identity.sessionId, branchId: identity.branchId, generation: 0 })
    this.#leases = new SessionLeases()
    if (leases) this.#leases = leases
  }

  sibling(identity: SessionIdentity): MemorySession {
    return new MemorySession(identity, this.#leases)
  }

  stamp(): OperationStamp {
    return this.#stamp
  }

  signal(stamp: OperationStamp): AbortSignal {
    if (!this.isCurrent(stamp)) return AbortSignal.abort()
    return this.#controller.signal
  }

  isCurrent(stamp: OperationStamp): boolean {
    return !this.#aborted && stamp === this.#stamp
  }

  acquire(stamp: OperationStamp, callerSignal: AbortSignal): Promise<Lease | null> {
    if (!this.isCurrent(stamp)) return Promise.resolve(null)
    return this.#leases.acquire(AbortSignal.any([callerSignal, this.#controller.signal]))
  }

  acceptConfiguration(stamp: OperationStamp, hash: string): boolean {
    if (!this.isCurrent(stamp)) return false
    if (!this.#configuration.bound) {
      this.#configuration = { bound: true, hash }
      return true
    }
    if (this.#configuration.hash === hash) return true
    this.invalidate(this.#stamp)
    return false
  }

  rememberGet(stamp: OperationStamp, read: DeliveredRead): boolean {
    if (!this.isCurrent(stamp)) return false
    this.#receipts.remember(read)
    return true
  }

  getReceipt(stamp: OperationStamp, address: MemoryAddress): DeliveredRead | null {
    if (!this.isCurrent(stamp)) return null
    return this.#receipts.get(address)
  }

  consumeReceipt(stamp: OperationStamp, address: MemoryAddress): void {
    if (this.isCurrent(stamp)) this.#receipts.consume(address)
  }

  invalidate(identity: SessionIdentity): void {
    const previous = this.#controller
    this.#stamp = Object.freeze({
      sessionId: identity.sessionId,
      branchId: identity.branchId,
      generation: this.#stamp.generation + 1,
    })
    this.#configuration = { bound: false }
    this.#receipts.clear()
    if (!this.#aborted) this.#controller = new AbortController()
    previous.abort()
  }

  stopAdmissions(): void {
    this.#leases.stopAdmissions()
  }

  abortPending(): void {
    this.stopAdmissions()
    this.#aborted = true
    this.#configuration = { bound: false }
    this.#receipts.clear()
    this.#controller.abort()
  }

  drain(): Promise<void> {
    return this.#leases.drain()
  }
}

export function createMemorySession(identity: SessionIdentity): MemorySession {
  return new MemorySession(identity)
}
