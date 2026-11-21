import type { AvailableModels, MemoryPiContext } from "#src/pi/context"
import type { CompletionPort } from "#src/usecases"

export function registryCompletion(ctx: MemoryPiContext): CompletionPort {
  return nativeModelCompletion(ctx.modelRegistry)
}

export function nativeModelCompletion(models: AvailableModels): CompletionPort {
  return async (request) => {
    const model = models.find(request.model.provider, request.model.id)
    if (!model) return { status: "unsupported" }
    const message = await models.complete(
      model,
      { systemPrompt: request.system, messages: [{ role: "user", content: request.data, timestamp: Date.now() }] },
      { signal: request.signal, maxTokens: model.maxTokens },
    )
    if (message.stopReason === "aborted") return { status: "aborted" }
    if (message.stopReason === "error") {
      if (message.errorMessage) return { status: "error", error: message.errorMessage }
      return { status: "error" }
    }
    const text = message.content.flatMap((part) => {
      if (part.type === "text") return [part.text]
      return []
    })
    if (text.length === 0) return { status: "empty" }
    return { status: "completed", text: text.join("") }
  }
}
