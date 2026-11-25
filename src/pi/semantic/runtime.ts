import type { MemoryPiContext } from "#src/pi/context"
import {
  createRemoteSemantic,
  type LocalModelAccess,
  type LocalSemantic,
  localModelAccess,
  type SemanticPort,
  type SemanticSource,
} from "#src/usecases"
import { MODEL_INVALID, SESSION_CLOSED, SHUTDOWN_FAILED } from "./constants.ts"

export class SemanticRuntime {
  #context: MemoryPiContext | null = null
  #local: LocalSemantic | null = null
  #opening: Promise<SemanticPort> | null = null
  #lifetime = new AbortController()
  #modelCachePath: string
  #access: LocalModelAccess = localModelAccess

  constructor(modelCachePath: string, access?: LocalModelAccess) {
    this.#modelCachePath = modelCachePath
    if (access) this.#access = access
  }

  readonly source: SemanticSource = (configuration) => {
    if (configuration.provider === "local") return this.#localPort()
    return this.#remotePort(configuration.provider)
  }

  attach(context: MemoryPiContext): void {
    if (this.#lifetime.signal.aborted) this.#lifetime = new AbortController()
    this.#context = context
  }

  async shutdown(): Promise<void> {
    const local = this.#local
    const context = this.#context
    this.#lifetime.abort()
    this.#opening = null
    this.#local = null
    this.#context = null
    if (!local) return
    try {
      await local.dispose()
    } catch (error) {
      if (!(error instanceof Error)) throw error
      if (context?.hasUI) context.ui.notify(`${SHUTDOWN_FAILED} ${error.message}`, "warning")
    }
  }

  async #localPort(): Promise<SemanticPort> {
    if (this.#local) return this.#local.port
    const { signal } = this.#lifetime
    if (signal.aborted) return { available: false, reason: SESSION_CLOSED }
    if (!this.#opening) {
      this.#opening = this.#openLocalPort(signal).finally(() => {
        if (!signal.aborted) this.#opening = null
      })
    }
    return this.#opening
  }

  async #openLocalPort(signal: AbortSignal): Promise<SemanticPort> {
    try {
      const status = await this.#access.check(this.#modelCachePath, signal)
      if (signal.aborted) return { available: false, reason: SESSION_CLOSED }
      if (status === "invalid") return { available: false, reason: MODEL_INVALID }
      this.#local = this.#access.create({ cachePath: this.#modelCachePath })
      return this.#local.port
    } catch (error) {
      if (signal.aborted) return { available: false, reason: SESSION_CLOSED }
      throw error
    }
  }

  async #remotePort(provider: "openai" | "google"): Promise<SemanticPort> {
    const apiKey = await this.#context?.modelRegistry.getApiKeyForProvider(provider)
    if (typeof apiKey !== "string" || apiKey === "") return { available: false, reason: `no API key for ${provider}` }
    return createRemoteSemantic(provider, apiKey)
  }
}
