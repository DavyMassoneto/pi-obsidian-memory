export const defaultLayaSettings = {
  provider: "laya",
  endpoint: "http://127.0.0.1:8000/v1/systemone",
  model: "multilingual",
  maxTokens: 8192,
  headMaxTokens: 192,
} as const

export const defaultJevModel = "jev-latest"
export const decisionTimeoutMs = 30_000
export const maxDecisionResponseBytes = 65_536
