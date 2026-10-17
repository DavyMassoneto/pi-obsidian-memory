import { defaultLayaSettings, type LayaContext } from "#src/services"

export function liveLayaEndpoint(): string {
  const configured = process.env.LAYA_ENDPOINT
  if (configured) return configured
  return defaultLayaSettings.endpoint
}

export async function layaServerUnavailableReason(): Promise<string | null> {
  const endpoint = liveLayaEndpoint()
  try {
    const response = await fetch(new URL("/health", endpoint), { signal: AbortSignal.timeout(2000) })
    if (response.ok) return null
    return `laya-serve at ${endpoint} answered /health with HTTP ${response.status}`
  } catch {
    return `no laya-serve is listening at ${endpoint} (start it with: laya-serve, or set LAYA_ENDPOINT)`
  }
}

export function liveLayaContextWithTokens(maxTokens: number, headMaxTokens: number): LayaContext {
  return {
    provider: "laya",
    endpoint: liveLayaEndpoint(),
    model: defaultLayaSettings.model,
    maxTokens,
    headMaxTokens,
    signal: new AbortController().signal,
  }
}

export function liveLayaContext(): LayaContext {
  return liveLayaContextWithTokens(defaultLayaSettings.maxTokens, defaultLayaSettings.headMaxTokens)
}
