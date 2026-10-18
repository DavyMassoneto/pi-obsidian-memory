import { DECISION_TITLE, LAYA_DEFAULT_ENDPOINT, LAYA_ENDPOINT_TITLE } from "#src/pi"
import { rewriteConfig } from "./e2e-config.ts"
import type { UiAnswer, UiStep } from "./e2e-protocol.ts"
import type { E2eWorld } from "./e2e-world.ts"

export interface Cutoffs {
  gateThreshold?: number
  relevanceThreshold?: number
}

export const LAYA_MODEL = {
  provider: "laya",
  endpoint: LAYA_DEFAULT_ENDPOINT,
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
} as const

export function typing(title: string, value: string): UiStep {
  return { method: "input", title, answer: { value } }
}

export function decision(option: string): UiStep {
  return { method: "select", title: DECISION_TITLE, answer: { option } }
}

export function endpoint(answer: UiAnswer): UiStep {
  return { method: "input", title: LAYA_ENDPOINT_TITLE, answer }
}

export function onLaya(world: E2eWorld, extra: Cutoffs): Promise<string> {
  return rewriteConfig(world, { decisionModel: { ...LAYA_MODEL, ...extra } })
}
