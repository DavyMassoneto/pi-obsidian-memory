import type { StepBuilder } from "./plan.types.ts"
import { changelogStep, checkoutStep, commitStep, finishStep, pushStep, startStep, versionStep } from "./steps.ts"

export const STEPS: readonly StepBuilder[] = [
  startStep,
  versionStep,
  changelogStep,
  commitStep,
  finishStep,
  checkoutStep,
  pushStep,
]
