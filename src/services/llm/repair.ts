import { type CheckedObservation, type MaterialSource, parseRepairReply } from "#src/domain"
import { checkStep, completeStep, completionRequest } from "./complete.ts"
import { REPAIR_POLICY } from "./constants.ts"
import type { CompletionPort, CompletionRequest, RepairRequest, RepairStepResult } from "./types.ts"

export function repairData(sources: MaterialSource[], observations: CheckedObservation[]): string {
  return JSON.stringify({ sources, observations })
}

export function repairRequest(request: RepairRequest): CompletionRequest {
  const prompt = { system: REPAIR_POLICY, data: repairData(request.sources, request.observations) }
  return { ...completionRequest(request, prompt), thinking: request.thinking }
}

export async function repairStep(request: RepairRequest, complete: CompletionPort): Promise<RepairStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(repairRequest(request), complete)
  if (!result.succeeded) return result
  return parseRepairReply(result.output)
}
