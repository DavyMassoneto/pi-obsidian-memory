import { readConfigFields } from "./fields.ts"
import { parseConfig } from "./parse.ts"
import type { ConfigRepairDraft } from "./types.ts"

export function inspectConfigForRepair(text: string): ConfigRepairDraft {
  const draft = prepareSetupDefaults()
  const parsed = parseConfig(text)
  if (!parsed.succeeded) {
    draft.problems = parsed.problems
  }
  try {
    const fields = readConfigFields(text)
    draft.global = fields.global
    draft.projects = fields.projects
    draft.limits = { ...draft.limits, ...fields.limits }
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }
    draft.replacementRequired = true
  }
  return draft
}

export function prepareSetupDefaults(): ConfigRepairDraft {
  return {
    global: {},
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
    replacementRequired: false,
    problems: [],
  }
}
