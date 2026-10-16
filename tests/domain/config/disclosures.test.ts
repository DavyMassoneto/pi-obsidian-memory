import { expect, test } from "vitest"

import type { MemoryConfig } from "#src/domain"
import { setupDisclosures } from "#src/domain"
import { aConfig } from "#test-helpers"

const jev: MemoryConfig["decisionModel"] = { provider: "typesafe", model: "jev-latest" }
const openai: MemoryConfig["embeddings"] = { provider: "openai", model: "text-embedding-3-small" }
const google: MemoryConfig["embeddings"] = { provider: "google", model: "gemini-embedding-001" }

test("local embeddings and the Laya decision model disclose only the chat models", () => {
  expect(setupDisclosures(aConfig())).toEqual(["chat-models"])
})

test("the Jev decision model adds jev", () => {
  expect(setupDisclosures({ ...aConfig(), decisionModel: jev })).toEqual(["chat-models", "jev"])
})

test("OpenAI and Google embeddings add remote-embeddings", () => {
  expect(setupDisclosures({ ...aConfig(), embeddings: openai })).toEqual(["chat-models", "remote-embeddings"])
  expect(setupDisclosures({ ...aConfig(), embeddings: google })).toEqual(["chat-models", "remote-embeddings"])
})

test("combined disclosures keep the order chat-models, jev, remote-embeddings", () => {
  expect(setupDisclosures({ ...aConfig(), decisionModel: jev, embeddings: google })).toEqual([
    "chat-models",
    "jev",
    "remote-embeddings",
  ])
})
