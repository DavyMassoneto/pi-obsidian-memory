import type { SessionRecord } from "#src/services"
import type { Failed, Succeeded } from "#src/shared"
import type { MemoryOperationRefusal } from "#src/usecases/operation-context"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface CompactSessionRequest {
  records: SessionRecord[]
}

export interface CompactedSession {
  summary: string
  firstKeptEntryId: string
}

export interface CompactionRefusal extends Failed {
  reason: "not-observed"
}

export type CompactSessionResult =
  | Succeeded<CompactedSession>
  | CompactionRefusal
  | MemoryResolutionRefusal
  | MemoryOperationRefusal
