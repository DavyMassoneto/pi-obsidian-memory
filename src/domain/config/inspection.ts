import { Value } from "typebox/value"

import { configFieldName, configObjectProblems, configValueProblems } from "./diagnostics.ts"
import { upgradeLegacyConfig } from "./legacy-config.ts"
import { configObservationRules, configRuleSelection } from "./observations.ts"
import { configRules } from "./rules.ts"
import { ConfigFieldObservationSchema, ConfigObjectSchema, MemoryConfigSchema } from "./schemas.ts"
import type { ConfigDocumentInspection, ConfigFieldObservation, ConfigInspection } from "./types.ts"

export function inspectConfig(text: string): ConfigInspection {
  try {
    return { validJson: true, ...readConfigInspection(text) }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    return { validJson: false, message: error.message }
  }
}

export function readConfigInspection(text: string): ConfigDocumentInspection {
  const document = JSON.parse(upgradeLegacyConfig(text))
  const projects = Value.Pointer.Get(document, "/projects")
  let projectCount = 0
  if (Array.isArray(projects)) projectCount = projects.length
  const observations: ConfigFieldObservation[] = []
  for (const rule of configObservationRules(projectCount)) {
    const observation = { field: rule.field, index: rule.index, value: Value.Pointer.Get(document, rule.path) }
    if (Value.Check(ConfigFieldObservationSchema, observation)) observations.push(observation)
  }
  const problems = configRules(configRuleSelection(projectCount, observations)).flatMap((rule) => {
    const value = Value.Pointer.Get(document, rule.path)
    if (rule.path.length > 0 && !Value.Pointer.Has(document, rule.path)) return []
    if (rule.kind === "value") return configValueProblems(rule.path, Value.Errors(rule.schema, value))
    if (Value.Check(ConfigObjectSchema, value)) return configObjectProblems(rule, Object.keys(value))
    return [`${configFieldName(rule.path, "")}: must be object`]
  })
  if (Value.Pointer.Has(document, "/projects") && !Array.isArray(projects)) problems.push("projects: must be array")
  const max = Value.Pointer.Get(document, "/decisionModel/maxTokens")
  const head = Value.Pointer.Get(document, "/decisionModel/headMaxTokens")
  const invalidTokenOrder = typeof max === "number" && typeof head === "number" && head >= max
  const inspection = { observations, projectCount, shapeProblems: problems, invalidTokenOrder }
  if (Value.Check(MemoryConfigSchema, document)) return { ...inspection, config: { succeeded: true, output: document } }
  return { ...inspection, config: { succeeded: false } }
}
