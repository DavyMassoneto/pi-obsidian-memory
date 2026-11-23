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
        observer: { model: selectedModel, thinking: "low", chunkTokens: 10000, concurrency: 4 },
        memoryAgent: { model: selectedModel },
      },
    },
  })
  expect(await readdir(root)).toEqual([])
  await expectRegistrationLeaseReleased(context)
})

test("the selected model is proposed for the consolidator too", async () => {
  const { root, context } = await registrationUsecaseFixture()
  const selectedModel = { provider: "chosen", id: "chat" }
  const result = await prepareMemorySetup({ selectedModel }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      draft: {
        consolidator: {
          model: selectedModel,
          thinking: "medium",
          atPoolTokens: 15000,
          poolTargetTokens: 10000,
          journeyTokens: 1000,
        },
      },
    },
  })
  expect(await readdir(root)).toEqual([])
  await expectRegistrationLeaseReleased(context)
})

test("a consolidator model with a missing part takes the selection for that part only", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({
      ...config,
      ...customizedSettings(),
      consolidator: { ...customizedSettings().consolidator, model: { provider: "kept", id: 7 } },
    }),
  )
  const result = await prepareMemorySetup({ selectedModel: { provider: "chosen", id: "chosen-id" } }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: { draft: { consolidator: { model: { provider: "kept", id: "chosen-id" }, thinking: "high" } } },
  })
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
    output: { draft: { observer: { model: {} }, memoryAgent: { model: {} } } },
  })
  expect(await readdir(root)).toEqual([])
})

test("invalid nested fields keep valid siblings and use selection only for missing model parts", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const text = JSON.stringify({
    ...config,
    ...customizedSettings(),
    observer: { model: { provider: "kept", id: 7 }, thinking: "high", chunkTokens: 5000, concurrency: 2 },
    memoryAgent: { model: { provider: false, id: "retained-id" } },
    limits: { maxBodyChars: 321, maxStatementChars: -1 },
    unknown: "discard me",
  })
  await writeRegistrationSnapshot(context, text)
  const before = await registrationDiskTree(root)
  const result = await prepareMemorySetup({ selectedModel: { provider: "chosen", id: "chosen-id" } }, context)
  expect(result).toMatchObject({
    succeeded: true,
    output: {
      draft: {
        observer: { model: { provider: "kept", id: "chosen-id" }, thinking: "high", chunkTokens: 5000, concurrency: 2 },
        memoryAgent: { model: { provider: "chosen", id: "retained-id" } },
        limits: { maxBodyChars: 321, maxStatementChars: 100 },
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

test("setup preserves an old config while dropping the retired setting without a repair warning", async () => {
  const { context, config } = await registrationUsecaseFixture()
  const settings = { ...customizedSettings(), limits: { maxBodyChars: 1234, maxStatementChars: 123 } }
  const text = JSON.stringify({ ...config, ...settings, limits: { ...settings.limits, maxNotesPerFolder: 35 } })
  await writeRegistrationSnapshot(context, text)

  const result = await prepareMemorySetup({ selectedModel: null }, context)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) throw new Error("setup preparation failed")
  expect(result.output.draft).toMatchObject({
    ...settings,
    global: config.global,
    projects: config.projects,
    problems: [],
  })
  expect(result.output.draft.limits).toEqual(settings.limits)
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
    output: { draft: { replacementRequired: true, observer: { model: {} } } },
  })
  expect(await readFile(context.configPath, "utf8")).toBe("{malformed")
  expect(await registrationDiskTree(root)).toEqual(before)
})
