import {
  decisionTimeoutMs,
  fitBudget,
  loadedNoteBlock,
  MAX_RETRIEVAL_DURATION_MS,
  shouldRetrieveMemory,
} from "#src/services"
import {
  captureMemoryOperationContext,
  limitOperation,
  type MemoryOperationContext,
} from "#src/usecases/operation-context"
import { type ResolvedMemory, resolveMemory } from "#src/usecases/resolve-memory"
import { findNotes } from "./agent.ts"
import {
  BLOCK_SEPARATOR,
  MAX_QUERY_CHARS,
  MESSAGE_LIMIT_MS,
  NO_CHANGES,
  OUT_OF_TIME,
  RELEVANT_INTRO,
} from "./constants.ts"
import { cutoffsMissingNotice, decidingCutoffs, resolveCutoffs } from "./cutoffs.ts"
import { decisionContextOf, decisionNotice, needsMemory, rankNotes } from "./decision.ts"
import { refreshLoaded } from "./refresh.ts"
import type { RankedNotes, RetrieveDeps, RetrieveMemoryResult, RetrieveRequest } from "./types.ts"

export async function retrieveMemory(
  request: RetrieveRequest,
  callerContext: MemoryOperationContext,
  deps: RetrieveDeps,
): Promise<RetrieveMemoryResult> {
  const limited = limitOperation(captureMemoryOperationContext(callerContext), MESSAGE_LIMIT_MS)
  try {
    const result = await retrieveWithin(request, limited.context, deps)
    if (!limited.expired()) return result
    return timedOut(result)
  } finally {
    limited.release()
  }
}

function timedOut(result: RetrieveMemoryResult): RetrieveMemoryResult {
  if (!result.succeeded) return { succeeded: true, output: { text: null, notices: [OUT_OF_TIME], changes: NO_CHANGES } }
  return { succeeded: true, output: { ...result.output, notices: [OUT_OF_TIME] } }
}

async function retrieveWithin(
  request: RetrieveRequest,
  context: MemoryOperationContext,
  deps: RetrieveDeps,
): Promise<RetrieveMemoryResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const refreshed = await refreshLoaded(deps.loaded, context)
  const blocks = refreshed.blocks
  let found: RankedNotes = { notes: [], notice: null }
  if (request.message.trim() !== "") found = await relevantNotes(request.message, resolved.output, context, deps)
  const fitted = fitBudget(found.notes, resolved.output.config.context.budgetChars)
  for (const note of fitted) deps.loaded.remember(note)
  blocks.push(...fitted.map(loadedNoteBlock))
  let text: string | null = null
  if (blocks.length > 0) text = [RELEVANT_INTRO, ...blocks].join(BLOCK_SEPARATOR)
  const notices: string[] = []
  if (found.notice) notices.push(found.notice)
  const changes = { loaded: [...refreshed.changes.loaded, ...fitted], forgotten: refreshed.changes.forgotten }
  return { succeeded: true, output: { text, notices, changes } }
}

async function relevantNotes(
  message: string,
  memory: ResolvedMemory,
  context: MemoryOperationContext,
  deps: RetrieveDeps,
): Promise<RankedNotes> {
  const report = resolveCutoffs(memory.config.decisionModel)
  const cutoffs = decidingCutoffs(report)
  if (!cutoffs) return { notes: [], notice: cutoffsMissingNotice(report) }
  const limits = { deadlineMs: Date.now() + decisionTimeoutMs + MAX_RETRIEVAL_DURATION_MS, signal: context.signal }
  const decision = await decisionContextOf(memory.config.decisionModel, limits, deps.jev)
  if (typeof decision === "string") return { notes: [], notice: decision }
  let project: string | null = null
  if (memory.project) project = memory.project.vault.name
  const folder = context.workingFolder
  const needed = await needsMemory(decision, message, project, folder)
  if (!needed.succeeded) return { notes: [], notice: decisionNotice(needed) }
  if (!shouldRetrieveMemory(needed.output.probability, cutoffs.gate)) return { notes: [], notice: null }
  const agent = await findNotes(
    {
      agent: { project, folder },
      query: message.slice(0, MAX_QUERY_CHARS),
      model: memory.config.memoryAgent.model,
      deadline: limits.deadlineMs,
    },
    context,
    deps.complete,
  )
  if (!agent.succeeded) return { notes: [], notice: agent.notice }
  const fresh = agent.output.filter((note) => !note.dontForget && !deps.loaded.has(note))
  return rankNotes(decision, message, fresh, cutoffs.relevance)
}
