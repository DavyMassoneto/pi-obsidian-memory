import type { SessionEntry } from "@earendil-works/pi-coding-agent"

import type { ChatModelSource, DialogOptions, MemoryPiContext } from "#src/pi"

export interface PromptScript {
  selects: (string | undefined)[]
  inputs: (string | undefined)[]
  confirms: (boolean | Promise<boolean>)[]
}

export interface AskedPrompt {
  kind: "select" | "confirm" | "input"
  title: string
  message: string
  options: string[]
  dialog: DialogOptions | null
}

export interface RecordedNotification {
  message: string
  type: string | undefined
}

export interface FakePiContextOptions {
  cwd: string
  hasUI: boolean
  sessionId: string
  model: ChatModelSource | undefined
  available: ChatModelSource[]
  noCredentials: string[]
  apiKeys: string[]
  hangingInputs: boolean
  branch: SessionEntry[]
  emptyApiKeys: string[]
  answers: Partial<PromptScript>
}

export function noAnswers(): PromptScript {
  return { selects: [], inputs: [], confirms: [] }
}

export function fakePiContext(cwd: string, overrides: Partial<FakePiContextOptions>) {
  const base: FakePiContextOptions = {
    cwd,
    hasUI: true,
    sessionId: "session-one",
    model: { provider: "test-chat", id: "selected-chat" },
    available: [],
    noCredentials: [],
    apiKeys: [],
    hangingInputs: false,
    branch: [],
    emptyApiKeys: [],
    answers: {},
  }
  const options = { ...base, ...overrides }
  const script = { ...noAnswers(), ...options.answers }
  const selects = [...script.selects]
  const inputs = [...script.inputs]
  const confirms = [...script.confirms]
  const prompts: AskedPrompt[] = []
  const notifications: RecordedNotification[] = []
  const context: MemoryPiContext = {
    cwd: options.cwd,
    hasUI: options.hasUI,
    model: options.model,
    modelRegistry: {
      getAvailable: () => options.available,
      find: (provider, modelId) =>
        options.available.find((model) => model.provider === provider && model.id === modelId),
      async getApiKeyAndHeaders(model) {
        if (options.noCredentials.includes(`${model.provider}/${model.id}`)) return { ok: false, error: "No API key" }
        return { ok: true }
      },
      async complete() {
        throw new Error("unexpected model completion")
      },
      async getApiKeyForProvider(provider) {
        if (options.apiKeys.includes(provider)) return `key-${provider}`
        if (options.emptyApiKeys.includes(provider)) return ""
        return undefined
      },
    },
    sessionManager: { getSessionId: () => options.sessionId, getBranch: () => options.branch },
    ui: {
      async select(title, choices) {
        prompts.push({ kind: "select", title, message: "", options: choices, dialog: null })
        if (selects.length === 0) throw new Error(`unexpected select: ${title}`)
        return selects.shift()
      },
      async confirm(title, message) {
        prompts.push({ kind: "confirm", title, message, options: [], dialog: null })
        const answer = confirms.shift()
        if (typeof answer === "boolean" || answer instanceof Promise) return answer
        throw new Error(`unexpected confirm: ${title}`)
      },
      async input(title, placeholder, dialog) {
        let message = ""
        if (typeof placeholder === "string") message = placeholder
        let recorded: DialogOptions | null = null
        if (dialog) recorded = dialog
        prompts.push({ kind: "input", title, message, options: [], dialog: recorded })
        if (inputs.length === 0 && options.hangingInputs) return unanswered(dialog)
        if (inputs.length === 0) throw new Error(`unexpected input: ${title}`)
        return inputs.shift()
      },
      notify(message, type) {
        notifications.push({ message, type })
      },
    },
  }
  return { context, prompts, notifications }
}

export function unanswered(dialog: DialogOptions | undefined): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (dialog?.signal?.aborted) return resolve(undefined)
    dialog?.signal?.addEventListener("abort", () => resolve(undefined), { once: true })
    if (typeof dialog?.timeout === "number") setTimeout(() => resolve(undefined), dialog.timeout)
  })
}
