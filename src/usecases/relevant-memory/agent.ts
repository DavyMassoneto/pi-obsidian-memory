import {
  type CompletionPort,
  type MemoryIdentity,
  type MemoryObservation,
  type ReadObservation,
  type RetrievalObservation,
  refusalObservation,
  retrieveStep,
} from "#src/services"
import { detailOf, observeGet, observeList, observeSearch } from "#src/usecases/capture-memory"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import { AGENT_FAILED } from "./constants.ts"
import type { AgentOutcome, AgentRequest, ReadStep } from "./types.ts"

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
    if (step.output.action === "finish") return { succeeded: true, output: chosen(step.output.notes, observations) }
    observations.push(await observe(step.output, context))
  }
}

function observe(action: ReadStep, context: MemoryOperationContext): Promise<MemoryObservation> {
  if (action.action === "search") return observeSearch(action.vault, action.query, context)
  if (action.action === "get") return observeGet({ vault: action.vault, path: action.path }, context)
  return observeList(action.vault, action.folder, context)
}

function chosen(identities: MemoryIdentity[], observations: RetrievalObservation[]): ReadObservation[] {
  const reads = observations.filter((observation) => observation.kind === "read")
  return identities.flatMap((identity) =>
    reads.filter(
      (read) =>
        read.vault === identity.vault &&
        read.path === identity.path &&
        read.id === identity.id &&
        read.hash === identity.hash,
    ),
  )
}
