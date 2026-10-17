import { SETUP_AGENT_MODEL_TITLE, SETUP_CAPTURE_MODEL_TITLE, SETUP_MODE_TITLE, SETUP_VAULT_TITLE } from "#src/pi"
import { E2E_MODEL, E2E_PROVIDER } from "./e2e-paths.ts"
import type { UiAnswer, UiStep } from "./e2e-protocol.ts"
import type { AvailableModel } from "./e2e-records.ts"

export const E2E_MODEL_LABEL = `${E2E_PROVIDER}/${E2E_MODEL}`

export const chooseE2eModel: UiAnswer = { option: E2E_MODEL_LABEL }

export const pressEscape: UiAnswer = { cancelled: true }

export function captureModelStep(answer: UiAnswer): UiStep {
  return { method: "select", title: SETUP_CAPTURE_MODEL_TITLE, answer }
}

export function agentModelStep(answer: UiAnswer): UiStep {
  return { method: "select", title: SETUP_AGENT_MODEL_TITLE, answer }
}

export function modeStep(answer: UiAnswer): UiStep {
  return { method: "select", title: SETUP_MODE_TITLE, answer }
}

export function vaultStep(title: string, answer: UiAnswer): UiStep {
  return { method: "input", title, answer }
}

export function firstSetupSteps(mode: string, vault: string): UiStep[] {
  return [
    captureModelStep(chooseE2eModel),
    agentModelStep(chooseE2eModel),
    modeStep({ option: mode }),
    vaultStep(SETUP_VAULT_TITLE, { value: vault }),
  ]
}

export function inputPrices(options: string[], models: AvailableModel[]): number[] {
  return options.map((option) => {
    const [reference] = option.split(" ")
    const model = models.find((candidate) => `${candidate.provider}/${candidate.id}` === reference)
    if (!model) throw new Error(`${option} is not an available model`)
    return model.cost.input
  })
}
