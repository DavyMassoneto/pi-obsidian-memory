import { join } from "node:path"

import { expect, test } from "vitest"

import { SemanticRuntime } from "#src/pi"
import { fakePiContext, recordingLocalAccess, useTempFolder } from "#test-helpers"

const local = { provider: "local", model: "Xenova/multilingual-e5-small" } as const
const openai = { provider: "openai", model: "text-embedding-3-small" } as const
const google = { provider: "google", model: "gemini-embedding-001" } as const

test("with a UI the local download is asked once, with its size and source, and a yes makes the port available", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, { answers: { confirms: [true] } })
  runtime.attach(context)

  const first = await runtime.source(local)
  const second = await runtime.source(local)
  await runtime.shutdown()

  expect(first).toMatchObject({ available: true })
  expect(second).toMatchObject({ available: true })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatchObject({ kind: "confirm", title: "Download the local search model?" })
  expect(prompts[0]?.message).toMatch(/About \d+ MB from huggingface\.co/)
})

test("declining the local download keeps semantic search off for the rest of the runtime without asking again", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, { answers: { confirms: [false] } })
  runtime.attach(context)

  const first = await runtime.source(local)
  const second = await runtime.source(local)

  expect(first).toEqual({ available: false, reason: "the local model download was declined for this runtime" })
  expect(second).toEqual(first)
  expect(prompts).toHaveLength(1)
})

test("without a UI the local model is not downloaded and the reason says so", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, { hasUI: false })
  runtime.attach(context)

  const port = await runtime.source(local)

  expect(port).toMatchObject({ available: false, reason: expect.stringContaining("no UI") })
  expect(prompts).toEqual([])
})

test("before any session is attached there is no UI to ask", async () => {
  const folder = await useTempFolder()

  const port = await new SemanticRuntime(join(folder, "models")).source(local)

  expect(port).toMatchObject({ available: false, reason: expect.stringContaining("no UI") })
})

test("a remote provider is disclosed once per runtime and its key comes from pi's registry", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, { apiKeys: ["openai"], answers: { confirms: [true] } })
  runtime.attach(context)

  const first = await runtime.source(openai)
  const second = await runtime.source(openai)

  expect(first).toMatchObject({ available: true })
  expect(second).toMatchObject({ available: true })
  expect(prompts).toHaveLength(1)
  expect(prompts[0]).toMatchObject({ kind: "confirm", title: "Send notes to a remote embeddings provider?" })
  expect(prompts[0]?.message).toContain("openai")
  expect(prompts[0]?.message).toContain("secrets included")
})

test("each remote provider is disclosed on its own", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, {
    apiKeys: ["openai", "google"],
    answers: { confirms: [true, true] },
  })
  runtime.attach(context)

  await runtime.source(openai)
  await runtime.source(google)

  expect(prompts.map((prompt) => prompt.message)).toEqual([
    expect.stringContaining("openai"),
    expect.stringContaining("google"),
  ])
})

test("declining the disclosure turns semantic search off and never swaps in the local model", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context, prompts } = fakePiContext(folder, { apiKeys: ["openai"], answers: { confirms: [false] } })
  runtime.attach(context)

  const first = await runtime.source(openai)
  const second = await runtime.source(openai)

  expect(first).toEqual({
    available: false,
    reason: "sending notes to the remote embeddings provider was declined for this runtime",
  })
  expect(second).toEqual(first)
  expect(prompts).toHaveLength(1)
  expect(prompts.map((prompt) => prompt.title)).not.toContain("Download the local search model?")
})

test("without a UI a remote provider cannot be disclosed, so it stays off", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { hasUI: false, apiKeys: ["openai"] })
  runtime.attach(context)

  expect(await runtime.source(openai)).toMatchObject({ available: false, reason: expect.stringContaining("no UI") })
})

test("a confirmed remote provider with no key in pi's registry says there is no API key", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { answers: { confirms: [true] } })
  runtime.attach(context)

  expect(await runtime.source(google)).toEqual({ available: false, reason: "no API key for google" })
})

test("after shutdown the runtime has no UI left to ask", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { apiKeys: ["openai"], answers: { confirms: [true] } })
  runtime.attach(context)
  await runtime.shutdown()

  expect(await runtime.source(google)).toMatchObject({ available: false, reason: expect.stringContaining("no UI") })
})

test("a model that is already cached is used without asking, and with no download consent", async () => {
  const folder = await useTempFolder()
  const { access, created } = recordingLocalAccess("cached")
  const runtime = new SemanticRuntime(join(folder, "models"), access)
  const { context, prompts } = fakePiContext(folder, {})
  runtime.attach(context)

  const port = await runtime.source(local)

  expect(port).toMatchObject({ available: true })
  expect(prompts).toEqual([])
  expect(created).toEqual([{ cachePath: join(folder, "models"), downloadConsent: false }])
})

test("a missing model that the user agreed to download is created with the download consent", async () => {
  const folder = await useTempFolder()
  const { access, created } = recordingLocalAccess("missing")
  const runtime = new SemanticRuntime(join(folder, "models"), access)
  const { context } = fakePiContext(folder, { answers: { confirms: [true] } })
  runtime.attach(context)

  await runtime.source(local)

  expect(created).toEqual([{ cachePath: join(folder, "models"), downloadConsent: true }])
})

test("a damaged model is not used, not downloaded again and nothing is asked", async () => {
  const folder = await useTempFolder()
  const { access, created } = recordingLocalAccess("invalid")
  const runtime = new SemanticRuntime(join(folder, "models"), access)
  const { context, prompts } = fakePiContext(folder, {})
  runtime.attach(context)

  const port = await runtime.source(local)

  expect(port).toMatchObject({ available: false, reason: expect.stringContaining("damaged") })
  expect(created).toEqual([])
  expect(prompts).toEqual([])
})

test("an empty API key counts as no API key", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { emptyApiKeys: ["openai"], answers: { confirms: [true] } })
  runtime.attach(context)

  expect(await runtime.source(openai)).toEqual({ available: false, reason: "no API key for openai" })
})

test("a local model that fails to shut down is reported to the user and never rejects", async () => {
  const folder = await useTempFolder()
  const { access } = recordingLocalAccess("cached")
  const failing = {
    ...access,
    create: (options: Parameters<typeof access.create>[0]) => ({
      ...access.create(options),
      dispose: async () => {
        throw new Error("model busy")
      },
    }),
  }
  const runtime = new SemanticRuntime(join(folder, "models"), failing)
  const { context, notifications } = fakePiContext(folder, {})
  runtime.attach(context)
  await runtime.source(local)

  await expect(runtime.shutdown()).resolves.toBeUndefined()

  expect(notifications).toEqual([
    { message: "The local search model did not shut down cleanly: model busy", type: "warning" },
  ])
})
