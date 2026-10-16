import type { RegistrationFailure, RegistrationOutcome } from "#src/usecases"
import {
  BOOTSTRAP_STAGE_LINE,
  CONFIG_STAGE_LINE,
  CREATED_HEADING,
  PRESERVED_HEADING,
  PROBLEMS_HEADING,
  VAULT_CREATED_LINE,
  WARNINGS_HEADING,
} from "./constants.ts"

export function describeRegistered(headline: string, outcome: RegistrationOutcome): string {
  const lines = [headline]
  if (outcome.assets.createdRoot) lines.push(VAULT_CREATED_LINE)
  if (outcome.assets.created.length > 0) lines.push(`${CREATED_HEADING} ${outcome.assets.created.join(", ")}`)
  if (outcome.assets.preserved.length > 0) lines.push(`${PRESERVED_HEADING} ${outcome.assets.preserved.join(", ")}`)
  if (outcome.warnings.length > 0) lines.push(WARNINGS_HEADING, ...outcome.warnings.map((warning) => `- ${warning}`))
  return lines.join("\n")
}

export function describeRegistrationFailure(failure: RegistrationFailure): string {
  const lines = [PROBLEMS_HEADING, ...failure.problems.map((problem) => `- ${problem}`)]
  if (failure.stage === "bootstrap") lines.push(BOOTSTRAP_STAGE_LINE)
  if (failure.stage === "config") lines.push(CONFIG_STAGE_LINE)
  return lines.join("\n")
}
