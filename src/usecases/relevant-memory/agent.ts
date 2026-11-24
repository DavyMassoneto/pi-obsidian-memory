import {
  type CompletionPort,
  type MemoryObservation,
  type MemoryReadAction,
  type ReadObservation,
  type RetrievalObservation,
  refusalObservation,
  retrieveStep,
} from "#src/services"
import { detailOf, observeGet, observeList, observeSearch } from "#src/usecases/capture-memory"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import { AGENT_FAILED } from "./constants.ts"
import type { AgentOutcome, AgentRequest } from "./types.ts"

export async function findNotes(
  request: AgentRequest,
  context: MemoryOperationContext,
  complete: CompletionPort,
): Promise<AgentOutcome> {
  const observations: RetrievalObservation[] = []
  for (;;) {
    if (memoryOperationInterruption(context)) return { succeeded: false, notice: null }
    const { agent, query, model } = request
    const step = await retrieveStep({ context: agent, query, observations, model, signal: context.signal }, complete)
    if (!step.succeeded && "modelCall" in step) {
      if (memoryOperationInterruption(context)) return { succeeded: false, notice: null }
      return { succeeded: false, notice: `${AGENT_FAILED} ${detailOf(step.problems)}` }
    }
    if (!step.succeeded) {
      observations.push(refusalObservation(step.problems))
      continue
    }
    if ("action" in step.output) return { succeeded: true, output: chosen(step.output.notes, observations) }
    for (const action of step.output.actions) observations.push(await observe(action, context))
  }
}

function observe(action: MemoryReadAction, context: MemoryOperationContext): Promise<MemoryObservation> {
  if (action.action === "search") return observeSearch(action.vault, action.query, context)
  if (action.action === "get") return observeGet({ vault: action.vault, path: action.path }, context)
  return observeList(action.vault, action.folder, context)
}

function chosen(indices: number[], observations: RetrievalObservation[]): ReadObservation[] {
  return indices.flatMap((index) => {
    const observation = observations[index]
    if (observation?.kind === "read") return [observation]
    return []
  })
}
