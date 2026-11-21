import type { CompletionFactory } from "#src/pi/completion"
import type { MemoryPaths } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import type { BoolQuestion, DecisionPrompt } from "#src/usecases"

export interface RelevantMemoryDeps {
  paths: MemoryPaths
  sessions: MemorySessionKeeper
  completionOf: CompletionFactory
}

export type JevPrompt = DecisionPrompt

export type JevQuestion = BoolQuestion
