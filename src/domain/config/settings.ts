import { Value } from "typebox/value"

import { DEFAULT_COMPACTION, DEFAULT_OBSERVER } from "./constants.ts"
import { repairDecision, repairEmbeddings } from "./resources.ts"
import { ChatModelReferenceSchema } from "./schemas.ts"
import type { ChatModelReference, ConfigRepairDraft } from "./types.ts"

export function prepareSetupDefaults(model: ChatModelReference | null): ConfigRepairDraft {
  let selected: Partial<ChatModelReference> = {}
  if (Value.Check(ChatModelReferenceSchema, model)) selected = model
  return {
    global: {},
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100, maxNotesPerFolder: 20 },
    observer: { model: { ...selected }, ...DEFAULT_OBSERVER },
    compaction: { ...DEFAULT_COMPACTION },
    memoryAgent: { model: { ...selected } },
    context: { budgetChars: 12000 },
    embeddings: repairEmbeddings({}),
    decisionModel: repairDecision({}),
    replacementRequired: false,
    problems: [],
  }
}
