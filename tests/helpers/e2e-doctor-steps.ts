import {
  COMPLETE_BODY_TITLE,
  COMPLETE_SKIPPED,
  COMPLETE_TYPE_TITLE,
  COMPLETED,
  DOCTOR_TITLE,
  MEMORY_DOCTOR_COMMAND,
} from "#src/pi"
import type { UiAnswer, UiStep } from "./e2e-protocol.ts"
import { notifySettles, type RpcTurn } from "./e2e-records.ts"
import { nth } from "./e2e-turns.ts"
import type { E2eWorld } from "./e2e-world.ts"

export function chooseType(label: string, answer: UiAnswer): UiStep {
  return { method: "select", title: `${COMPLETE_TYPE_TITLE} (${label})`, answer }
}

export function typeBody(label: string, answer: UiAnswer): UiStep {
  return { method: "input", title: `${COMPLETE_BODY_TITLE} (${label})`, answer }
}

export function confirmCompletion(label: string, type: string, confirmed: boolean): UiStep {
  return { method: "confirm", title: `${label} as a ${type} note?`, answer: { confirmed } }
}

export function runDoctor(world: Pick<E2eWorld, "pi">, steps: UiStep[], blanksOffered: number): Promise<RpcTurn> {
  const command = `/${MEMORY_DOCTOR_COMMAND}`
  if (blanksOffered === 0) return world.pi.command(command, steps, notifySettles([DOCTOR_TITLE]))
  return world.pi.command(command, steps, nth(notifySettles([COMPLETED, COMPLETE_SKIPPED]), blanksOffered))
}
