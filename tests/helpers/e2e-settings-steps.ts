import {
  DECISION_TITLE,
  EMBEDDING_CHOICES,
  LAYA_DEFAULT_ENDPOINT,
  LAYA_ENDPOINT_TITLE,
  PROJECT_ACTION_TITLE,
  PROJECT_TITLE,
  projectLabel,
} from "#src/pi"
import { leaveScreen, onlyProject, pickLine, rewriteConfig, storedConfig } from "./e2e-config.ts"
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

export async function withGateCutoff(world: E2eWorld): Promise<string> {
  const { decisionModel } = await storedConfig(world)
  if (decisionModel.provider !== "typesafe") throw new Error("the E2E world uses Jev")
  return rewriteConfig(world, { decisionModel: { ...decisionModel, gateThreshold: 0.3 } })
}

export async function openProject(world: E2eWorld, action: string, further: UiStep[]): Promise<UiStep[]> {
  const project = await onlyProject(world)
  return [
    pickLine("Projects:"),
    { method: "select", title: PROJECT_TITLE, answer: { option: projectLabel(project) } },
    { method: "select", title: PROJECT_ACTION_TITLE, answer: { option: action } },
    ...further,
    leaveScreen,
  ]
}

export function embeddingLabel(provider: string): string {
  const choice = EMBEDDING_CHOICES.find((candidate) => candidate.value.provider === provider)
  if (!choice) throw new Error(`no embeddings choice for ${provider}`)
  return choice.label
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
