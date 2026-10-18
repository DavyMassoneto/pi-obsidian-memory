import type { LayaContext } from "#src/services"

export function layaContext(endpoint: string): LayaContext {
  return {
    provider: "laya",
    endpoint,
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
    signal: new AbortController().signal,
  }
}

export const memoryDecisionRequest = { message: "Qual gerenciador uso?", project: "shop", folder: "src" }
export const candidateDecisionRequest = {
  message: "Qual gerenciador uso?",
  identity: { vault: "global" as const, id: "stable-note", revision: "hash" },
  candidate: { statement: "Use pnpm", body: "Secret sample-token stays literal." },
}
