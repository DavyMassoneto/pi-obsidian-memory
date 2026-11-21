import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import { Value } from "typebox/value"

import { RELEVANT_MESSAGE_TYPE } from "#src/pi/relevant-memory"
import { LoadedChangesSchema, loadMemoryMap, planObservationCompaction } from "#src/usecases"
import { observationCommits, observationSources } from "./session.ts"
import type { CompactionDoneHandler, ObservationCompactHandler, ObservationCompactionDeps } from "./types.ts"

export function observationCompactionHandler(deps: ObservationCompactionDeps): ObservationCompactHandler {
  return async (event, ctx) => {
    await deps.observer.settled()
    if (event.signal.aborted) return { cancel: true }
    const branch = ctx.sessionManager.getBranch()
    const operation = deps.sessions.retrievalOperation(ctx.cwd, deps.paths)
    let memoryMap = ""
    if (operation) {
      const loaded = await loadMemoryMap(operation)
      if (loaded.succeeded) memoryMap = loaded.output.text
    }
    const plan = planObservationCompaction({
      sources: observationSources(branch),
      commits: observationCommits(branch),
      memoryMap,
      tailTokens: event.preparation.settings.keepRecentTokens,
    })
    if (!plan) return undefined
    return {
      compaction: {
        summary: plan.summary,
        firstKeptEntryId: plan.firstKeptEntryId,
        tokensBefore: event.preparation.tokensBefore,
      },
    }
  }
}

export function compactionLoadedHandler(deps: Pick<ObservationCompactionDeps, "sessions">): CompactionDoneHandler {
  return async (event, ctx) => {
    const kept = retainedEntries(ctx.sessionManager.getBranch(), event.compactionEntry.firstKeptEntryId)
    const keys = retainedNoteKeys(kept)
    deps.sessions.loaded().retain((note) => keys.has(`${note.vault}:${note.path}`))
  }
}

function retainedEntries(branch: SessionEntry[], firstKeptEntryId: string): SessionEntry[] {
  const start = branch.findIndex((entry) => entry.id === firstKeptEntryId)
  if (start < 0) return []
  return branch.slice(start)
}

function retainedNoteKeys(entries: SessionEntry[]): Set<string> {
  const keys = new Set<string>()
  for (const entry of entries) {
    if (entry.type !== "custom_message" || entry.customType !== RELEVANT_MESSAGE_TYPE) continue
    if (!Value.Check(LoadedChangesSchema, entry.details)) continue
    for (const note of entry.details.forgotten) keys.delete(`${note.vault}:${note.path}`)
    for (const note of entry.details.loaded) keys.add(`${note.vault}:${note.path}`)
  }
  return keys
}
