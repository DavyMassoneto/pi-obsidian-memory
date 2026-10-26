import type { ChunkRange, MemoryConfig, ObserveStepResult, SessionRecord } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface CycleSettings {
  observer: MemoryConfig["observer"]
  compaction: MemoryConfig["compaction"]
}

export type CycleSettingsResult = Succeeded<CycleSettings> | MemoryResolutionRefusal

export interface ObserveChunkRequest {
  records: SessionRecord[]
  range: ChunkRange
}

export type ObserveChunkResult = ObserveStepResult | MemoryResolutionRefusal
