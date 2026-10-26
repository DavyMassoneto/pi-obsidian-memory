import type { CaptureCadenceSettings } from "#src/domain/capture"
import type { LegacyCaptureWhen, MemoryConfig } from "./types.ts"

export const THRESHOLD_TEXT = /^\d+(\.\d+)?$/

export const COUNT_TEXT = /^\d+$/

export const THRESHOLD_REASON = "must be a number from 0 to 1, for example 0.5"

export const COUNT_REASON = "must be a whole number of 1 or more"

export const DEFAULT_CAPTURE_CADENCE: CaptureCadenceSettings = {
  nudgeInterval: 10,
  nudgeToolCalls: 15,
  flushMinTurns: 6,
  reviewEnabled: true,
  flushOnCompact: true,
  flushOnShutdown: true,
}

export const DEFAULT_OBSERVER: Omit<MemoryConfig["observer"], "model"> = {
  thinking: "low",
  chunkTokens: 10000,
  concurrency: 4,
}

export const DEFAULT_COMPACTION: MemoryConfig["compaction"] = {
  atContextTokens: 150000,
  tailTokens: 20000,
  mapTokens: 2000,
}

export const LEGACY_CAPTURE_CADENCE: Record<LegacyCaptureWhen, CaptureCadenceSettings> = {
  "after-each-turn": DEFAULT_CAPTURE_CADENCE,
  "at-session-end": { ...DEFAULT_CAPTURE_CADENCE, reviewEnabled: false, flushOnCompact: false },
  "on-compaction": { ...DEFAULT_CAPTURE_CADENCE, reviewEnabled: false, flushOnShutdown: false },
}
