import { readFile } from "node:fs/promises"

import { expect, test } from "vitest"

import {
  blankPiFixture,
  brokenPiFixture,
  fakePiContext,
  layaModel,
  memoryReadTree,
  noteWithId,
  piMemoryFixture,
  piUnconfiguredFixture,
  putCatalogFile,
  relevanceScript,
  scriptedLaya,
  writeAgentConfig,
} from "#test-helpers"

const available = [{ provider: "test-chat", id: "selected-chat" }]

test("one report names the broken note, the copy, the blank note, the temporary file and the crowded folder", async () => {
  const { pi, workingFolder } = await brokenPiFixture()
  const { context, notifications } = fakePiContext(workingFolder, { available, answers: { selects: [undefined] } })

  await pi.runCommand("memory-doctor", context)

  const report = notifications[0]?.message
  expect(notifications[0]?.type).toBe("warning")
  for (const expected of ["tools/Broken.md", "Copy one.md", "Blank.md", "Half.md.tmp-abc", "crowded: 21 notes"]) {
    expect(report).toContain(expected)
  }
  expect(report).toContain("- capture test-chat/selected-chat: ok")
  expect(report).toContain("- embeddings local/Xenova/multilingual-e5-small: The local model is not downloaded yet")
  expect(report).toContain("- decision model laya/multilingual:")
})

test("a vault with no problems and every provider ready is reported as clean at info level and nothing is asked", async () => {
  const laya = await scriptedLaya(relevanceScript(0.9, new Map()))
  const { pi, workingFolder, vaults, configPath, config } = await piMemoryFixture()
  await writeAgentConfig(
    configPath,
    JSON.stringify({
      ...config,
      embeddings: { provider: "openai", model: "text-embedding-3-small" },
      decisionModel: layaModel(laya.endpoint),
    }),
  )
  await putCatalogFile(vaults.global, "Good.md", noteWithId(1, "Fine.", []))
  const { context, notifications, prompts } = fakePiContext(workingFolder, { available, apiKeys: ["openai"] })

  await pi.runCommand("memory-doctor", context)

  expect(notifications).toEqual([
    { message: expect.stringContaining("Global vault: no problems found."), type: "info" },
  ])
  expect(prompts).toEqual([])
})

test("a model with no credentials is reported", async () => {
  const { pi, workingFolder } = await piMemoryFixture()
  const { context, notifications } = fakePiContext(workingFolder, {
    available,
    noCredentials: ["test-chat/selected-chat"],
  })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain("- capture test-chat/selected-chat: No API key")
  expect(notifications[0]?.type).toBe("warning")
})

test("an empty blank note is completed with the chosen type and typed body only after the user confirms", async () => {
  const { pi, workingFolder, blankFile } = await blankPiFixture("")
  const { context, notifications, prompts } = fakePiContext(workingFolder, {
    available,
    answers: { selects: ["lesson"], inputs: ["Learned this."], confirms: [true] },
  })

  await pi.runCommand("memory-doctor", context)

  const text = await readFile(blankFile, "utf8")
  expect(text).toMatch(/^---\nid: [0-9A-Z]{26}\ntype: lesson\n/)
  expect(text).toContain("Learned this.")
  expect(prompts.map((prompt) => prompt.kind)).toEqual(["select", "input", "confirm"])
  expect(prompts[2]?.title).toContain("tools/Blank.md")
  expect(notifications.map((entry) => entry.type)).toEqual(["warning", "info"])
})

test("a blank note with text keeps its text as the body and asks no body", async () => {
  const { pi, workingFolder, blankFile } = await blankPiFixture("What the user typed")
  const { context, prompts } = fakePiContext(workingFolder, {
    available,
    answers: { selects: ["fact"], confirms: [true] },
  })

  await pi.runCommand("memory-doctor", context)

  expect(await readFile(blankFile, "utf8")).toContain("What the user typed")
  expect(prompts.map((prompt) => prompt.kind)).toEqual(["select", "confirm"])
})

test("declining the confirmation leaves the file exactly as it was", async () => {
  const { pi, workingFolder, blankFile, vaults } = await blankPiFixture("")
  const before = await memoryReadTree(vaults.global.path)
  const { context } = fakePiContext(workingFolder, {
    available,
    answers: { selects: ["lesson"], inputs: ["Learned this."], confirms: [false] },
  })

  await pi.runCommand("memory-doctor", context)

  expect(await readFile(blankFile, "utf8")).toBe("")
  expect(await memoryReadTree(vaults.global.path)).toEqual(before)
})

test("cancelling the type or the body leaves the file as it was", async () => {
  const { pi, workingFolder, blankFile } = await blankPiFixture("")
  const noType = fakePiContext(workingFolder, { available, answers: { selects: [undefined] } })
  const noBody = fakePiContext(workingFolder, { available, answers: { selects: ["lesson"], inputs: [undefined] } })

  await pi.runCommand("memory-doctor", noType.context)
  await pi.runCommand("memory-doctor", noBody.context)

  expect(await readFile(blankFile, "utf8")).toBe("")
  expect(noBody.prompts.map((prompt) => prompt.kind)).toEqual(["select", "input"])
})

test("every problem other than a confirmed blank note is left as it was on disk", async () => {
  const { pi, workingFolder, vaults } = await brokenPiFixture()
  const before = await memoryReadTree(vaults.global.path)
  const { context } = fakePiContext(workingFolder, { available, answers: { selects: [undefined] } })

  await pi.runCommand("memory-doctor", context)

  expect(await memoryReadTree(vaults.global.path)).toEqual(before)
})

test("without a config the doctor shows the config problem and says to run /memory-setup", async () => {
  const { pi, workingFolder } = await piUnconfiguredFixture()
  const { context, notifications } = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", context)

  expect(notifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "error" }])
})

test("without a UI nothing is shown or asked", async () => {
  const { pi, workingFolder } = await brokenPiFixture()
  const { context, prompts, notifications } = fakePiContext(workingFolder, { hasUI: false, available })

  await pi.runCommand("memory-doctor", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([])
})

test("a remote embeddings provider with an API key in pi is reported ready, without any network call", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  const openai = { provider: "openai", model: "text-embedding-3-small" }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, embeddings: openai }))
  const { context, notifications } = fakePiContext(workingFolder, { available, apiKeys: ["openai"] })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain("- embeddings openai/text-embedding-3-small: ready")
})

test("a remote embeddings provider with no API key is reported", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  const google = { provider: "google", model: "gemini-embedding-001" }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, embeddings: google }))
  const { context, notifications } = fakePiContext(workingFolder, { available })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain("- embeddings google/gemini-embedding-001: No API key for google")
  expect(notifications[0]?.type).toBe("warning")
})

test("an empty API key in pi's registry is reported as no API key", async () => {
  const { pi, workingFolder, configPath, config } = await piMemoryFixture()
  const openai = { provider: "openai", model: "text-embedding-3-small" }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, embeddings: openai }))
  const { context, notifications } = fakePiContext(workingFolder, { available, emptyApiKeys: ["openai"] })

  await pi.runCommand("memory-doctor", context)

  expect(notifications[0]?.message).toContain("- embeddings openai/text-embedding-3-small: No API key for openai")
})
