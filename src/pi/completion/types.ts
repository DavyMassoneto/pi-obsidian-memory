import type { MemoryPiContext } from "#src/pi/context"
import type { CompletionPort } from "#src/usecases"

export type CompletionContext = Pick<MemoryPiContext, "modelRegistry">

export type CompletionFactory = (ctx: MemoryPiContext) => CompletionPort

export interface TextPart {
  type: string
  text?: string
}
