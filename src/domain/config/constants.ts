import type { MemoryConfig } from "./types.ts"

export const THRESHOLD_TEXT = /^\d+(\.\d+)?$/

export const COUNT_TEXT = /^\d+$/

export const THRESHOLD_REASON = "must be a number from 0 to 1, for example 0.5"

export const COUNT_REASON = "must be a whole number of 1 or more"

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
