import type { ConfigRepairDraft, SetupPreparation } from "#src/usecases"

export interface VaultStep {
  snapshot: SetupPreparation["snapshot"]
  draft: ConfigRepairDraft
}
