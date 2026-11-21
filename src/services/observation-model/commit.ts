import type { ObservationCommit, ObserverDraft } from "#src/domain"
import { newNoteId } from "#src/services/id"

export function materializeObservations(sourceEntryIds: string[], drafts: ObserverDraft[]): ObservationCommit {
  const timestamp = new Date().toISOString()
  const observations = drafts.map((draft) => ({
    id: newNoteId(),
    timestamp,
    content: draft.content,
    sourceEntryIds: [...draft.sourceEntryIds],
    tokenCount: Math.ceil(draft.content.length / 4),
  }))
  return { sourceEntryIds: [...sourceEntryIds], observations }
}
