import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { prepareMemorySetup } from "#src/usecases"
import {
  customizedSettings,
  expectRegistrationLeaseReleased,
  registrationDiskTree,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("setup preparation proposes the selected model for the observer and the memory agent", async () => {
  const { root, context } = await registrationUsecaseFixture()
  const selectedModel = { provider: "chosen", id: "chat" }
  const result = await prepareMemorySetup({ selectedModel }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      snapshot: { state: "missing", hash: null },
      selectedModel,
      draft: {
        capture: { model: selectedModel },
        observer: { model: selectedModel, thinking: "low", chunkTokens: 10000, concurrency: 4 },
        memoryAgent: { model: selectedModel },
      },
    },
  })
  expect(await readdir(root)).toEqual([])
  await expectRegistrationLeaseReleased(context)
})

test("prepare owns the submitted model and config path before admission yields", async () => {
  const { root, context } = await registrationUsecaseFixture()
  const original = { ...context }
  const replacementPath = join(root, "replacement", "config.json")
  await writeRegistrationSnapshot({ ...context, configPath: replacementPath }, "{malformed")
  const before = await registrationDiskTree(root)
  const model = { provider: "submitted", id: "submitted-id" }
  const request = { selectedModel: model }
  const pending = prepareMemorySetup(request, context)
  model.id = "mutated"
  request.selectedModel = { provider: "replacement", id: "replacement-id" }
  context.configPath = replacementPath
  const result = await pending
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      snapshot: { state: "missing", hash: null },
      selectedModel: { provider: "submitted", id: "submitted-id" },
      draft: {
        capture: { model: { provider: "submitted", id: "submitted-id" } },
        observer: { model: { provider: "submitted", id: "submitted-id" } },
        memoryAgent: { model: { provider: "submitted", id: "submitted-id" } },
      },
    },
  })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(replacementPath, "utf8")).toBe("{malformed")
  await expectRegistrationLeaseReleased(original)
})

test("no selected model remains unresolved rather than inventing one", async () => {
  const { root, context } = await registrationUsecaseFixture()
  expect(await prepareMemorySetup({ selectedModel: null }, context)).toMatchObject({
    succeeded: true,
    output: { draft: { capture: { model: {} }, observer: { model: {} }, memoryAgent: { model: {} } } },
  })
  expect(await readdir(root)).toEqual([])
})

test("invalid nested fields keep valid siblings and use selection only for missing model parts", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const text = JSON.stringify({
    ...config,
    ...customizedSettings(),
    capture: { model: { provider: "retained", id: 42 }, when: "at-session-end" },
    observer: { model: { provider: "kept", id: 7 }, thinking: "high", chunkTokens: 5000, concurrency: 2 },
    memoryAgent: { model: { provider: false, id: "retained-id" } },
    limits: { maxBodyChars: 321, maxStatementChars: -1, maxNotesPerFolder: 9 },
    unknown: "discard me",
  })
  await writeRegistrationSnapshot(context, text)
  const before = await registrationDiskTree(root)
  const result = await prepareMemorySetup({ selectedModel: { provider: "chosen", id: "chosen-id" } }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      draft: {
        capture: { model: { provider: "retained", id: "chosen-id" }, reviewEnabled: false, flushOnCompact: false },
        observer: { model: { provider: "kept", id: "chosen-id" }, thinking: "high", chunkTokens: 5000, concurrency: 2 },
        memoryAgent: { model: { provider: "chosen", id: "retained-id" } },
        limits: { maxBodyChars: 321, maxStatementChars: 100, maxNotesPerFolder: 9 },
        embeddings: customizedSettings().embeddings,
        decisionModel: customizedSettings().decisionModel,
        problems: expect.arrayContaining([expect.stringContaining("unknown")]),
      },
    },
  })
  expect(await registrationDiskTree(root)).toEqual(before)
  expect(await readFile(context.configPath, "utf8")).toBe(text)
  await expectRegistrationLeaseReleased(context)
})

test("valid settings survive a different selection and malformed JSON stays a replacement draft", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const settings = customizedSettings()
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, ...settings }))
  expect(await prepareMemorySetup({ selectedModel: { provider: "new", id: "new" } }, context)).toMatchObject({
    succeeded: true,
    output: { draft: settings },
  })
  await writeRegistrationSnapshot(context, "{malformed")
  const before = await registrationDiskTree(root)
  expect(await prepareMemorySetup({ selectedModel: null }, context)).toMatchObject({
    succeeded: true,
    output: { draft: { replacementRequired: true, capture: { model: {} }, observer: { model: {} } } },
  })
  expect(await readFile(context.configPath, "utf8")).toBe("{malformed")
  expect(await registrationDiskTree(root)).toEqual(before)
})
