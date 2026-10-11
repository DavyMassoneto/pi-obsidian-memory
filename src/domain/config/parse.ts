import { inspectConfig } from "./inspection.ts"
import { registrationProblems } from "./invariants.ts"
import { observedConfigFields } from "./observations.ts"
import { inspectedResourceProblems } from "./resources.ts"
import type { ConfigInspection, ParseConfigResult } from "./types.ts"

export function parseConfig(text: string): ParseConfigResult {
  return parseConfigInspection(inspectConfig(text))
}

export function parseConfigInspection(inspection: ConfigInspection): ParseConfigResult {
  if (!inspection.validJson) {
    return { succeeded: false, problems: [`config: not valid JSON (${inspection.message})`] }
  }
  const problems = [...inspectedResourceProblems(inspection), ...registrationProblems(observedConfigFields(inspection))]
  if (!inspection.config.succeeded) {
    return { succeeded: false, problems: [...new Set([...inspection.shapeProblems, ...problems])] }
  }
  if (problems.length > 0) return { succeeded: false, problems }
  return inspection.config
}
