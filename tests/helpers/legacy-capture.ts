import type { CaptureCadenceSettings, MemoryConfig } from "#src/domain"
import { aConfig } from "./config.ts"

export const DEFAULT_CADENCE: CaptureCadenceSettings = {
  nudgeInterval: 10,
  nudgeToolCalls: 15,
  flushMinTurns: 6,
  reviewEnabled: true,
  flushOnCompact: true,
  flushOnShutdown: true,
}

export function upgradedCapture(overrides: Partial<CaptureCadenceSettings>): MemoryConfig["capture"] {
  return { model: aConfig().capture.model, ...DEFAULT_CADENCE, ...overrides }
}

export function legacyCaptureText(when: string, extra: Partial<CaptureCadenceSettings>): string {
  return JSON.stringify({ ...aConfig(), capture: { model: aConfig().capture.model, when, ...extra } })
}
