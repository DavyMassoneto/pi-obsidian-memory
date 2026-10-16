import { embedGoogle, embedOpenAI } from "#src/services"
import type { SemanticAvailable } from "#src/usecases/semantic-port"
import type { RemoteProvider } from "./types.ts"

export function createRemoteSemantic(provider: RemoteProvider, apiKey: string): SemanticAvailable {
  if (provider === "openai") {
    return { available: true, embed: (request, context) => embedOpenAI({ ...context, apiKey }, request) }
  }
  return { available: true, embed: (request, context) => embedGoogle({ ...context, apiKey }, request) }
}
