import type { CaptureDecision } from "#src/services"
import type { AppliedWrite, RejectedStep, WriteAction } from "./types.ts"

export function acceptedDecision(action: WriteAction, applied: AppliedWrite): CaptureDecision {
  const decision: CaptureDecision = {
    type: action.action,
    vault: action.vault,
    title: applied.path,
    accepted: true,
    applied: `${applied.status}: ${applied.detail}`,
  }
  if ("scopeReason" in action) decision.scopeReason = action.scopeReason
  return decision
}

export function rejectedDecision(step: RejectedStep): CaptureDecision {
  const decision: CaptureDecision = { type: "unparseable", accepted: false, error: step.problems.join("; ") }
  const { proposed } = step
  if (!proposed) return decision
  decision.type = proposed.action
  if (proposed.vault) decision.vault = proposed.vault
  if (proposed.title) decision.title = proposed.title
  if (proposed.scopeReason) decision.scopeReason = proposed.scopeReason
  return decision
}
