import type { MemoryPiContext, RegisteredModel, RegistryContext, RegistryMessage } from "#src/pi/context"
import type { CompletionPort, CompletionRequest } from "#src/usecases"
import type { TextPart } from "./types.ts"

export function registryCompletion(ctx: MemoryPiContext): CompletionPort {
  return async (request) => {
    const model = ctx.modelRegistry.find(request.model.provider, request.model.id)
    if (!model) return { status: "unsupported" }
    const message = await requestMessage(ctx, model, request)
    if (message.stopReason === "aborted") return { status: "aborted" }
    if (message.stopReason === "error") {
      if (message.errorMessage) return { status: "error", error: message.errorMessage }
      return { status: "error" }
    }
    const text = message.content.flatMap((part: TextPart) => {
      if (part.type === "text" && typeof part.text === "string") return [part.text]
      return []
    })
    if (text.length === 0) return { status: "empty" }
    return { status: "completed", text: text.join("") }
  }
}

async function requestMessage(
  ctx: MemoryPiContext,
  model: RegisteredModel,
  request: CompletionRequest,
): Promise<RegistryMessage> {
  const context: RegistryContext = {
    systemPrompt: request.system,
    messages: [{ role: "user", content: request.data, timestamp: Date.now() }],
  }
  const options = { signal: request.signal, maxTokens: model.maxTokens }
  if (typeof request.thinking !== "string") return ctx.modelRegistry.complete(model, context, options)
  if (request.thinking === "off") return ctx.modelRegistry.streamSimple(model, context, options).result()
  return ctx.modelRegistry.streamSimple(model, context, { ...options, reasoning: request.thinking }).result()
}
