import type { MemoryPiContext } from "#src/pi/context"
import type { CompletionPort } from "#src/usecases"
import type { TextPart } from "./types.ts"

export function registryCompletion(ctx: MemoryPiContext): CompletionPort {
  return async (request) => {
    const model = ctx.modelRegistry.find(request.model.provider, request.model.id)
    if (!model) return { status: "unsupported" }
    const message = await ctx.modelRegistry.complete(
      model,
      { systemPrompt: request.system, messages: [{ role: "user", content: request.data, timestamp: Date.now() }] },
      { signal: request.signal, maxTokens: request.maxTokens },
    )
    if (message.stopReason === "aborted") return { status: "aborted" }
    if (message.stopReason === "error") return { status: "error" }
    const text = message.content.flatMap((part: TextPart) => {
      if (part.type === "text" && typeof part.text === "string") return [part.text]
      return []
    })
    if (text.length === 0) return { status: "empty" }
    return { status: "completed", text: text.join("") }
  }
}
