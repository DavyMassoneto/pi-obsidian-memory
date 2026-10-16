import type { MemoryPiContext } from "#src/pi/context"
import {
  createRemoteSemantic,
  LOCAL_MODEL_SOURCE,
  type LocalModelAccess,
  type LocalSemantic,
  localModelAccess,
  localModelDownloadMegabytes,
  type SemanticPort,
  type SemanticSource,
} from "#src/usecases"
import {
  DISCLOSURE_ANSWER_PREFIX,
  DISCLOSURE_DECLINED,
  DOWNLOAD_ANSWER,
  DOWNLOAD_DECLINED,
  DOWNLOAD_TITLE,
  MODEL_INVALID,
  NO_UI_DISCLOSURE,
  NO_UI_DOWNLOAD,
  REMOTE_DISCLOSURE_TITLE,
  SHUTDOWN_FAILED,
} from "./constants.ts"

export class SemanticRuntime {
  #context: MemoryPiContext | null = null
  #answers = new Map<string, boolean>()
  #local: LocalSemantic | null = null
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
    this.#context = context
  }

  async shutdown(): Promise<void> {
    const local = this.#local
    const context = this.#context
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
    const status = await this.#access.check(this.#modelCachePath, new AbortController().signal)
    if (status === "invalid") return { available: false, reason: MODEL_INVALID }
    if (status === "missing") {
      const refusal = await this.#askOnce(
        DOWNLOAD_ANSWER,
        DOWNLOAD_TITLE,
        downloadMessage(),
        NO_UI_DOWNLOAD,
        DOWNLOAD_DECLINED,
      )
      if (refusal) return { available: false, reason: refusal }
    }
    this.#local = this.#access.create({ cachePath: this.#modelCachePath, downloadConsent: status === "missing" })
    return this.#local.port
  }

  async #remotePort(provider: "openai" | "google"): Promise<SemanticPort> {
    const message = `Note content (secrets included) and search queries go to ${provider}.`
    const refusal = await this.#askOnce(
      `${DISCLOSURE_ANSWER_PREFIX}${provider}`,
      REMOTE_DISCLOSURE_TITLE,
      message,
      NO_UI_DISCLOSURE,
      DISCLOSURE_DECLINED,
    )
    if (refusal) return { available: false, reason: refusal }
    const apiKey = await this.#context?.modelRegistry.getApiKeyForProvider(provider)
    if (typeof apiKey !== "string" || apiKey === "") return { available: false, reason: `no API key for ${provider}` }
    return createRemoteSemantic(provider, apiKey)
  }

  async #askOnce(key: string, title: string, message: string, noUi: string, declined: string): Promise<string | null> {
    const known = this.#answers.get(key)
    if (typeof known === "boolean") return refusalOf(known, declined)
    const context = this.#context
    if (!context?.hasUI) return noUi
    const answer = await context.ui.confirm(title, message)
    this.#answers.set(key, answer)
    return refusalOf(answer, declined)
  }
}

function refusalOf(answer: boolean, declined: string): string | null {
  if (answer) return null
  return declined
}

function downloadMessage(): string {
  const megabytes = localModelDownloadMegabytes()
  return `About ${megabytes} MB from ${LOCAL_MODEL_SOURCE}, stored outside the vaults. Asked once per run.`
}
