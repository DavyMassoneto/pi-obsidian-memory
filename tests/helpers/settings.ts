import type { ConfigFields, MemoryConfig } from "#src/domain"

export function emptyConfigFields(): ConfigFields {
  return {
    global: {},
    projects: [],
    limits: {},
    observer: { model: {} },
    compaction: {},
    memoryAgent: { model: {} },
    context: {},
    embeddings: {},
    decisionModel: {},
  }
}

export function productSettings(): Omit<MemoryConfig, "global" | "projects"> {
  return {
    limits: { maxBodyChars: 1000, maxStatementChars: 100, maxNotesPerFolder: 20 },
    observer: {
      model: { provider: "test-chat", id: "selected-chat" },
      thinking: "low",
      chunkTokens: 10000,
      concurrency: 4,
    },
    compaction: { atContextTokens: 150000, tailTokens: 20000, mapTokens: 2000 },
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
    observer: {
      model: { provider: "observer-provider", id: "observer-id" },
      thinking: "high",
      chunkTokens: 5000,
      concurrency: 2,
    },
    compaction: { atContextTokens: 90000, tailTokens: 8000, mapTokens: 1200 },
    memoryAgent: { model: { provider: "memory-provider", id: "memory-id" } },
    context: { budgetChars: 4321 },
    embeddings: { provider: "google", model: "gemini-embedding-001" },
    decisionModel: { provider: "typesafe", model: "jev-latest" },
  }
}
