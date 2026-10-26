import type { PathPlatform } from "#src/domain/path-platform"
import { inspectConfig } from "./inspection.ts"
import { observedConfigFields } from "./observations.ts"
import { parseConfigInspection } from "./parse.ts"
import { repairDecision, repairEmbeddings } from "./resources.ts"
import { prepareSetupDefaults } from "./settings.ts"
import type { ConfigAssessment, ConfigInspection, ConfigRepairDraft, ParseConfigResult } from "./types.ts"

export function inspectConfigForRepair(text: string, platform: PathPlatform): ConfigRepairDraft {
  return assessConfig(text, platform).repair
}

export function assessConfig(text: string, platform: PathPlatform): ConfigAssessment {
  const inspection = inspectConfig(text)
  const lexicalParse = parseConfigInspection(inspection, platform)
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
  draft.observer = { ...draft.observer, ...fields.observer }
  draft.compaction = { ...draft.compaction, ...fields.compaction }
  draft.memoryAgent = fields.memoryAgent
  draft.context = { ...draft.context, ...fields.context }
  draft.embeddings = repairEmbeddings(fields.embeddings)
  draft.decisionModel = repairDecision(fields.decisionModel)
  return draft
}
