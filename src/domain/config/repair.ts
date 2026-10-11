import { inspectConfig } from "./inspection.ts"
import { observedConfigFields } from "./observations.ts"
import { parseConfigInspection } from "./parse.ts"
import { repairDecision, repairEmbeddings } from "./resources.ts"
import { prepareSetupDefaults } from "./settings.ts"
import type { ConfigAssessment, ConfigInspection, ConfigRepairDraft, ParseConfigResult } from "./types.ts"

export function inspectConfigForRepair(text: string): ConfigRepairDraft {
  return assessConfig(text).repair
}

export function assessConfig(text: string): ConfigAssessment {
  const inspection = inspectConfig(text)
  const lexicalParse = parseConfigInspection(inspection)
  return { lexicalParse, repair: repairConfigInspection(inspection, lexicalParse) }
}

function repairConfigInspection(inspection: ConfigInspection, parsed: ParseConfigResult): ConfigRepairDraft {
  const draft = prepareSetupDefaults(null)
  if (!parsed.succeeded) draft.problems = [...parsed.problems]
  if (!inspection.validJson) {
    draft.replacementRequired = true
    return draft
  }
  const fields = observedConfigFields(inspection)
  draft.global = fields.global
  draft.projects = fields.projects
  draft.limits = { ...draft.limits, ...fields.limits }
  draft.capture = { ...draft.capture, ...fields.capture }
  draft.memoryAgent = fields.memoryAgent
  draft.context = { ...draft.context, ...fields.context }
  draft.embeddings = repairEmbeddings(fields.embeddings)
  draft.decisionModel = repairDecision(fields.decisionModel)
  return draft
}
