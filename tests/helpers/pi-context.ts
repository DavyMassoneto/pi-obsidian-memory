import type { SessionEntry } from "@earendil-works/pi-coding-agent"

import type {
  ChatModelSource,
  ClassifierModelRef,
  ClassifierOutcome,
  ClassifierPrompt,
  DialogOptions,
  MemoryPiContext,
} from "#src/pi"

export interface PromptScript {
  selects: (string | undefined)[]
  inputs: (string | undefined | Promise<string | undefined>)[]
  confirms: (boolean | Promise<boolean>)[]
}

export interface AskedPrompt {
  kind: "select" | "confirm" | "input"
  title: string
  message: string
  options: string[]
  dialog: DialogOptions | null
}

export type ClassifyFake = (prompt: ClassifierPrompt) => Promise<ClassifierOutcome>

export interface RecordedNotification {
  message: string
  type: string | undefined
}

export interface RecordedStatus {
  key: string
  text: string | undefined
}

export interface FakePiContextOptions {
  cwd: string
  hasUI: boolean
  sessionId: string
  model: ChatModelSource | undefined
  available: ChatModelSource[]
  noCredentials: string[]
  apiKeys: string[]
  classify: ClassifyFake | null
  branch: SessionEntry[]
  emptyApiKeys: string[]
  answers: Partial<PromptScript>
}

export function noAnswers(): PromptScript {
  return { selects: [], inputs: [], confirms: [] }
}

const JEV_MODEL: ClassifierModelRef = {
  type: "classifier",
  id: "jev-latest",
  name: "Jev",
  api: "typesafe-system-one",
  provider: "typesafe",
  baseUrl: "https://api.typesafe.test/v1/systemone",
  input: ["text"],
  contextWindow: 8192,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
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
    classify: null,
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
  const statuses: RecordedStatus[] = []
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
      findOfType(_type, provider, modelId) {
        if (options.classify && provider === "typesafe" && modelId === "jev-latest") return JEV_MODEL
        return undefined
      },
      async classify(_model, prompt) {
        if (!options.classify) throw new Error("unexpected classification")
        return options.classify(prompt)
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
        if (inputs.length === 0) throw new Error(`unexpected input: ${title}`)
        return inputs.shift()
      },
      notify(message, type) {
        notifications.push({ message, type })
      },
      setStatus(key, text) {
        statuses.push({ key, text })
      },
    },
  }
  return { context, prompts, notifications, statuses }
}

export function jevClassifier(): ClassifyFake {
  return async () => {
    throw new Error("the doctor must not classify")
  }
}
