import { expect, test } from "vitest"

import {
  decisionServer,
  fakePiContext,
  jevClassifier,
  layaModel,
  piMemoryFixture,
  writeAgentConfig,
} from "#test-helpers"

const available = [{ provider: "test-chat", id: "selected-chat" }]

test("Jev is ready when pi has its classifier model and an API key, and a problem otherwise", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, decisionModel: { provider: "typesafe", model: "jev-latest" } }),
  )
  const ready = fakePiContext(workingFolder, { available, apiKeys: ["typesafe"], classify: jevClassifier() })
  const bare = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", ready.context)
  await pi.runCommand("memory-doctor", bare.context)

  expect(ready.notifications[0]?.message).toContain("- decision model typesafe/jev-latest: ready")
  expect(bare.notifications[0]?.message).toContain(
    "- decision model typesafe/jev-latest: pi has no typesafe jev-latest classifier model",
  )
  expect(bare.notifications[0]?.type).toBe("warning")
})

test("a Jev model without an API key is reported, and on its own it makes the report a warning", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({
      ...config,
      embeddings: { provider: "openai", model: "text-embedding-3-small" },
      decisionModel: { provider: "typesafe", model: "jev-latest" },
    }),
  )
  const { context, notifications } = fakePiContext(workingFolder, {
    available,
    apiKeys: ["openai"],
    classify: jevClassifier(),
  })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain("- decision model typesafe/jev-latest: No API key for typesafe")
  expect(notifications[0]?.type).toBe("warning")
})

test("a Laya that does not answer is a warning with the cause, and one that answers is ready", async () => {
  const closed = await decisionServer({ body: "", status: 200, delayMs: 0 })
  const { endpoint } = closed.context
  await closed.close()
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  await writeAgentConfig(configPath, JSON.stringify({ ...config, decisionModel: layaModel(endpoint) }))
  const { context, notifications } = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain(
    `- decision model laya/multilingual: ${endpoint} is not answering: unavailable`,
  )
  expect(notifications[0]?.type).toBe("warning")
})

test("Jev lists TypeSafe's starting values as its cutoffs", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, decisionModel: { provider: "typesafe", model: "jev-latest" } }),
  )
  const { context, notifications } = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain(
    "- decision cutoffs: gate 0.5 (TypeSafe starting value), relevance 0.5 (TypeSafe starting value)",
  )
})

test("a Laya with no cutoffs set is a warning that points to the docs", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  const bareLaya = {
    provider: "laya",
    endpoint: "http://127.0.0.1:1/v1/systemone",
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
  }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, decisionModel: bareLaya }))
  const { context, notifications } = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain(
    "- decision cutoffs: gate missing, relevance missing; set decisionModel.gateThreshold and relevanceThreshold, see docs/decision-thresholds.md",
  )
})
