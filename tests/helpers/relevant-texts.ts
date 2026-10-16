import { invalidatedBlock, loadedNoteBlock, type ReadObservation, replacementBlock } from "#src/services"
import * as usecases from "#src/usecases"

const ALPHA: ReadObservation = {
  kind: "read",
  vault: "global",
  path: "tools/Alpha.md",
  id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
  hash: "a".repeat(64),
  statement: "Alpha",
  body: "Alpha body.",
  type: "rule",
  dontForget: false,
}

const RELEVANT_CONSTANTS = [
  usecases.RELEVANT_INTRO,
  usecases.SESSION_INTRO,
  usecases.SESSION_QUERY_PREFIX,
  usecases.NO_PROJECT,
  usecases.AGENT_FAILED,
  usecases.AGENT_UNFINISHED,
  usecases.DECISION_UNAVAILABLE,
  usecases.SESSION_LOAD_FAILED,
]

export function relevantTexts(): string[] {
  const constants = RELEVANT_CONSTANTS
  const edited = { ...ALPHA, body: "Edited body." }
  return [
    ...constants,
    loadedNoteBlock(ALPHA),
    replacementBlock(ALPHA, edited),
    invalidatedBlock(ALPHA),
    [usecases.RELEVANT_INTRO, loadedNoteBlock(ALPHA), replacementBlock(ALPHA, edited), invalidatedBlock(ALPHA)].join(
      usecases.BLOCK_SEPARATOR,
    ),
  ]
}
