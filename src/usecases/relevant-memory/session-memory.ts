import { fitBudget, loadedNoteBlock, MAX_RETRIEVAL_DURATION_MS } from "#src/services"
import {
  captureMemoryOperationContext,
  type LimitedOperation,
  limitOperation,
  type MemoryOperationContext,
} from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import { findNotes } from "./agent.ts"
import {
  BLOCK_SEPARATOR,
  NO_CHANGES,
  NO_PROJECT,
  OUT_OF_TIME,
  SESSION_INTRO,
  SESSION_LOAD_FAILED,
  SESSION_QUERY_PREFIX,
} from "./constants.ts"
import type { RetrievedMemory, RetrieveMemoryResult, SessionMemoryDeps } from "./types.ts"

export async function loadSessionMemory(
  callerContext: MemoryOperationContext,
  deps: SessionMemoryDeps,
): Promise<RetrieveMemoryResult> {
  const limited = limitOperation(captureMemoryOperationContext(callerContext), MAX_RETRIEVAL_DURATION_MS)
  try {
    return await loadWithin(limited, deps)
  } finally {
    limited.release()
  }
}

async function loadWithin(limited: LimitedOperation, deps: SessionMemoryDeps): Promise<RetrieveMemoryResult> {
  const { context } = limited
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { config, project } = resolved.output
  const { workingFolder } = context
  let name: string | null = null
  let label = NO_PROJECT
  if (project) {
    name = project.vault.name
    label = name
  }
  const found = await findNotes(
    {
      agent: { project: name, folder: workingFolder },
      query: `${SESSION_QUERY_PREFIX} ${label} in ${workingFolder}`,
      model: config.memoryAgent.model,
      deadline: Date.now() + MAX_RETRIEVAL_DURATION_MS,
    },
    context,
    deps.complete,
  )
  if (!found.succeeded) return { succeeded: true, output: failedLoad(found.notice, limited.expired()) }
  const fitted = fitBudget(
    found.output.filter((note) => !note.dontForget),
    config.context.budgetChars,
  )
  for (const note of fitted) deps.loaded.remember(note)
  if (fitted.length === 0) return { succeeded: true, output: { text: null, notices: [], changes: NO_CHANGES } }
  const text = [SESSION_INTRO, ...fitted.map(loadedNoteBlock)].join(BLOCK_SEPARATOR)
  return { succeeded: true, output: { text, notices: [], changes: NO_CHANGES } }
}

function failedLoad(notice: string | null, expired: boolean): RetrievedMemory {
  let reason = notice
  if (typeof reason !== "string" && expired) reason = OUT_OF_TIME
  if (typeof reason !== "string") return { text: null, notices: [], changes: NO_CHANGES }
  const text = `${SESSION_LOAD_FAILED} ${reason}`
  return { text, notices: [text], changes: NO_CHANGES }
}
