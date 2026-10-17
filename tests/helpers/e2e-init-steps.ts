import { INIT_CANCELLED, INIT_DONE, INIT_NAME_TITLE, MEMORY_INIT_COMMAND } from "#src/pi"
import type { UiStep } from "./e2e-protocol.ts"
import { notifySettles, type RpcTurn } from "./e2e-records.ts"
import { pressEscape } from "./e2e-setup-steps.ts"
import type { E2eWorld } from "./e2e-world.ts"

const initSettles = notifySettles([INIT_DONE, INIT_CANCELLED])

export function runInit(world: E2eWorld, steps: UiStep[]): Promise<RpcTurn> {
  return world.pi.command(`/${MEMORY_INIT_COMMAND}`, steps, initSettles)
}

export function nameStep(value: string): UiStep {
  return { method: "input", title: INIT_NAME_TITLE, answer: { value } }
}

export function nameStepEscape(): UiStep {
  return { method: "input", title: INIT_NAME_TITLE, answer: pressEscape }
}

export function initVaultStep(title: string, value: string): UiStep {
  return { method: "input", title, answer: { value } }
}

export function errorsOf(turn: RpcTurn): string[] {
  return turn.notifications.filter((notice) => notice.notifyType === "error").map((notice) => notice.message)
}
