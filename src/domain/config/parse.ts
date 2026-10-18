import type { PathPlatform } from "#src/domain/path-platform"
import { inspectConfig } from "./inspection.ts"
import { registrationProblems } from "./invariants.ts"
import { observedConfigFields } from "./observations.ts"
import { inspectedResourceProblems } from "./resources.ts"
import type { ConfigInspection, ParseConfigResult } from "./types.ts"

export function parseConfig(text: string, platform: PathPlatform): ParseConfigResult {
  return parseConfigInspection(inspectConfig(text), platform)
}

export function parseConfigInspection(inspection: ConfigInspection, platform: PathPlatform): ParseConfigResult {
  if (!inspection.validJson) {
    return { succeeded: false, problems: [`config: not valid JSON (${inspection.message})`] }
  }
  const problems = [
    ...inspectedResourceProblems(inspection),
    ...registrationProblems(observedConfigFields(inspection), platform),
  ]
  if (!inspection.config.succeeded) {
    return { succeeded: false, problems: [...new Set([...inspection.shapeProblems, ...problems])] }
  }
  if (problems.length > 0) return { succeeded: false, problems }
  return inspection.config
}
