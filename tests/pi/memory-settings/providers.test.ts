import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { SCREEN, savedConfig, screenContext, settingsFixture, writeAgentConfig } from "#test-helpers"

const JEV = "Jev (TypeSafe, by API)"
const LAYA = "Laya (local)"

test("switching to Jev writes it, clears the thresholds and warns that messages and notes go to TypeSafe", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, decisionModel: { ...config.decisionModel, gateThreshold: 0.3 } }),
  )
  const { context, notifications, prompts } = screenContext(workingFolder, [SCREEN.decision, JEV, SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  expect(prompts[1]?.options).toEqual([`${LAYA} (current)`, JEV])
  expect(notifications.map((item) => item.type)).toEqual(["warning", "info"])
  expect(notifications[0]?.message).toContain("TypeSafe")
  expect(notifications[1]?.message).toContain("cutoffs")
})

test("switching to Laya asks for the endpoint with the default as its placeholder, and starts without cutoffs", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, decisionModel: { provider: "typesafe", model: "jev-latest" } }),
  )
  const endpoint = "http://127.0.0.1:9000/v1/systemone"
  const { context, prompts } = screenContext(workingFolder, ["Decision model: Jev (TypeSafe)", LAYA, SCREEN.done], {
    inputs: [endpoint],
  })

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).decisionModel).toEqual({
    provider: "laya",
    endpoint,
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
  })
  expect(prompts.find((prompt) => prompt.kind === "input")?.message).toBe("http://127.0.0.1:8000/v1/systemone")
})

test("keeping Laya and giving a new endpoint keeps its cutoffs", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, decisionModel: { ...config.decisionModel, relevanceThreshold: 0.2 } }),
  )
  const endpoint = "http://127.0.0.1:9001/v1/systemone"
  const { context } = screenContext(workingFolder, [SCREEN.decision, `${LAYA} (current)`, SCREEN.done], {
    inputs: [endpoint],
  })

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).decisionModel).toMatchObject({ endpoint, relevanceThreshold: 0.2 })
})

test("a Laya endpoint that is not on this machine is refused with the reason and nothing changes", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = screenContext(workingFolder, [SCREEN.decision, `${LAYA} (current)`, SCREEN.done], {
    inputs: ["https://example.com/v1/systemone"],
  })

  await pi.runCommand("memory-setup", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toEqual([{ message: expect.stringContaining("loopback"), type: "error" }])
})

test("Escape on the endpoint or on the provider list changes nothing", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = screenContext(
    workingFolder,
    [SCREEN.decision, undefined, SCREEN.decision, `${LAYA} (current)`, SCREEN.done],
    { inputs: [undefined] },
  )

  await pi.runCommand("memory-setup", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toEqual([])
})

test("choosing a remote embeddings provider warns that note content, secrets included, goes to it", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const { context, notifications, prompts } = screenContext(
    workingFolder,
    [SCREEN.embeddings, "openai (text-embedding-3-small)", SCREEN.done],
    {},
  )

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).embeddings).toEqual({ provider: "openai", model: "text-embedding-3-small" })
  expect(prompts[1]?.options).toEqual([
    "local (Xenova/multilingual-e5-small) (current)",
    "openai (text-embedding-3-small)",
    "google (gemini-embedding-001)",
  ])
  expect(notifications.map((item) => item.type)).toEqual(["warning", "info"])
  expect(notifications[0]?.message).toContain("secrets included")
})

test("going back to the local embeddings shows no warning", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({ ...config, embeddings: { provider: "google", model: "gemini-embedding-001" } }),
  )
  const { context, notifications } = screenContext(
    workingFolder,
    ["Embeddings: google (gemini-embedding-001)", "local (Xenova/multilingual-e5-small)", SCREEN.done],
    {},
  )

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).embeddings.provider).toBe("local")
  expect(notifications.map((item) => item.type)).toEqual(["info"])
})
