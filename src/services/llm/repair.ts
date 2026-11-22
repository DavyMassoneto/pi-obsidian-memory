import { type CheckedObservation, parseRepairReply } from "#src/domain"
import { checkStep, completeStep } from "./complete.ts"
import { REPAIR_DATA_BEGIN, REPAIR_DATA_END, REPAIR_POLICY } from "./constants.ts"
import type { CompletionPort, CompletionRequest, RepairRequest, RepairStepResult } from "./types.ts"

export function repairData(chunk: string, observations: CheckedObservation[]): string {
  return [`${REPAIR_DATA_BEGIN}\n${chunk}\n${REPAIR_DATA_END}`, JSON.stringify({ observations })].join("\n\n")
}

export function repairRequest(request: RepairRequest): CompletionRequest {
  return {
    model: { ...request.model },
    signal: request.signal,
    system: REPAIR_POLICY,
    data: repairData(request.chunk, request.observations),
    thinking: request.thinking,
  }
}

export async function repairStep(request: RepairRequest, complete: CompletionPort): Promise<RepairStepResult> {
  const refused = checkStep(request)
  if (refused) return refused
  const result = await completeStep(repairRequest(request), complete)
  if (!result.succeeded) return result
  return parseRepairReply(result.output)
}
