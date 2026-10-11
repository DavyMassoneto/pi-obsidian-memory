import type { ConfigFields, MemoryConfig } from "#/domain"

export function emptyConfigFields(): ConfigFields {
  return {
    global: {},
    projects: [],
    limits: {},
    capture: { model: {} },
    memoryAgent: { model: {} },
    context: {},
    embeddings: {},
    decisionModel: {},
  }
}

export function productSettings(): Omit<MemoryConfig, "global" | "projects"> {
  return {
    limits: { maxBodyChars: 1000, maxStatementChars: 100, maxNotesPerFolder: 20 },
    capture: { model: { provider: "test-chat", id: "selected-chat" }, when: "after-each-turn" },
    memoryAgent: { model: { provider: "test-chat", id: "selected-chat" } },
    context: { budgetChars: 12000 },
    embeddings: { provider: "local", model: "Xenova/multilingual-e5-small" },
    decisionModel: {
      provider: "laya",
      endpoint: "http://127.0.0.1:8000/v1/systemone",
      model: "multilingual",
      maxTokens: 8192,
      headMaxTokens: 192,
    },
  }
}

export function customizedSettings(): Omit<MemoryConfig, "global" | "projects"> {
  return {
    limits: { maxBodyChars: 2000, maxStatementChars: 200, maxNotesPerFolder: 30 },
    capture: { model: { provider: "capture-provider", id: "capture-id" }, when: "on-compaction" },
    memoryAgent: { model: { provider: "memory-provider", id: "memory-id" } },
    context: { budgetChars: 4321 },
    embeddings: { provider: "google", model: "gemini-embedding-001" },
    decisionModel: { provider: "typesafe", model: "jev-latest" },
  }
}
