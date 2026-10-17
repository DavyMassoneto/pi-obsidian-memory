import { readFile } from "node:fs/promises"

import { expect, test, vi } from "vitest"

import { fakePiContext, SCREEN, screenContext, settingsFixture, writeAgentConfig } from "#test-helpers"

test("a valid config opens the settings screen: every setting and the projects, each with its current value", async () => {
  const { pi, workingFolder, globalVault } = await settingsFixture()
  const { context, prompts } = screenContext(workingFolder, [SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect(prompts).toHaveLength(1)
  expect(prompts[0]?.options).toEqual([
    SCREEN.captureModel,
    SCREEN.captureWhen,
    SCREEN.agentModel,
    SCREEN.decision,
    SCREEN.gate,
    SCREEN.relevance,
    SCREEN.embeddings,
    SCREEN.budget,
    SCREEN.maxBody,
    SCREEN.maxStatement,
    SCREEN.maxNotes,
    `Global vault: ${globalVault}`,
    SCREEN.projects,
    SCREEN.done,
  ])
})

test("Done and Escape both leave without writing or saying anything", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const before = await readFile(configPath, "utf8")
  const done = screenContext(workingFolder, [SCREEN.done], {})
  const escaped = screenContext(workingFolder, [undefined], {})

  await pi.runCommand("memory-setup", done.context)
  await pi.runCommand("memory-setup", escaped.context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(done.notifications).toEqual([])
  expect(escaped.notifications).toEqual([])
})

test("without a UI nothing is asked and nothing is written", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const before = await readFile(configPath, "utf8")
  const { context, prompts, notifications } = fakePiContext(workingFolder, { hasUI: false })

  await pi.runCommand("memory-setup", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([])
  expect(await readFile(configPath, "utf8")).toBe(before)
})

test("the screen shows each cutoff with where it comes from, and the Jev default", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  const jev = { ...config, decisionModel: { provider: "typesafe", model: "jev-latest", gateThreshold: 0.3 } }
  await writeAgentConfig(configPath, JSON.stringify(jev))
  const { context, prompts } = screenContext(workingFolder, [SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect(prompts[0]?.options).toContain("Decision model: Jev (TypeSafe)")
  expect(prompts[0]?.options).toContain("Gate cutoff: 0.3 (set)")
  expect(prompts[0]?.options).toContain("Relevance cutoff: 0.5 (TypeSafe starting value)")
})

test("shutting the session down while the screen is open ends it quietly, without an error", async () => {
  const { pi, workingFolder } = await settingsFixture()
  const answer = Promise.withResolvers<string | undefined>()
  const { context, prompts, notifications } = screenContext(workingFolder, [SCREEN.budget, SCREEN.done], {
    inputs: [answer.promise],
  })
  await pi.startSession(context, "startup")

  const running = pi.runCommand("memory-setup", context)
  await vi.waitFor(() => expect(prompts.some((prompt) => prompt.kind === "input")).toBe(true))
  await pi.shutdownSession(context)
  answer.resolve("500")
  await running

  expect(notifications.filter((item) => item.type === "error")).toEqual([])
})
