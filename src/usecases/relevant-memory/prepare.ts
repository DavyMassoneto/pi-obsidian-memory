import type { MemoryOperationContext } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import { DECISION_UNAVAILABLE } from "./constants.ts"
import type { JevSource } from "./types.ts"

export async function prepareDecisionModel(context: MemoryOperationContext, jev: JevSource): Promise<string | null> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return null
  const { decisionModel } = resolved.output.config
  if (decisionModel.provider !== "typesafe") return null
  const access = await jev(decisionModel.model)
  if (access.available) return null
  return `${DECISION_UNAVAILABLE} ${access.reason}`
}
