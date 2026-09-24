import { changelogStep, checkoutStep, commitStep, finishStep, pushStep, startStep, versionStep } from "./steps.ts"
import type { StepBuilder } from "./types.ts"

export const STEPS: readonly StepBuilder[] = [
  startStep,
  versionStep,
  changelogStep,
  commitStep,
  finishStep,
  checkoutStep,
  pushStep,
]
