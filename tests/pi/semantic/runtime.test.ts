import { join } from "node:path"

import { expect, test } from "vitest"

import { SemanticRuntime } from "#src/pi"
import { fakePiContext, recordingLocalAccess, useTempFolder } from "#test-helpers"

const local = { provider: "local", model: "Xenova/multilingual-e5-small" } as const
const openai = { provider: "openai", model: "text-embedding-3-small" } as const
const google = { provider: "google", model: "gemini-embedding-001" } as const

test.each([true, false])(
  "a local model that is not downloaded yet gives a port without any question (UI: %s)",
  async (hasUI) => {
    const folder = await useTempFolder()
    const runtime = new SemanticRuntime(join(folder, "models"))
    const { context, prompts } = fakePiContext(folder, { hasUI })
    runtime.attach(context)

    const first = await runtime.source(local)
    const second = await runtime.source(local)
    await runtime.shutdown()

    expect(first).toMatchObject({ available: true })
    expect(second).toMatchObject({ available: true })
    expect(prompts).toEqual([])
  },
)

test("the local model is used before any session is attached", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))

  const port = await runtime.source(local)
  await runtime.shutdown()

  expect(port).toMatchObject({ available: true })
})

test.each([true, false])(
  "a remote provider is used with its key from pi's registry and nothing is asked (UI: %s)",
  async (hasUI) => {
    const folder = await useTempFolder()
    const runtime = new SemanticRuntime(join(folder, "models"))
    const { context, prompts } = fakePiContext(folder, { hasUI, apiKeys: ["openai", "google"] })
    runtime.attach(context)

    expect(await runtime.source(openai)).toMatchObject({ available: true })
    expect(await runtime.source(google)).toMatchObject({ available: true })
    expect(prompts).toEqual([])
  },
)

test("a remote provider with no key in pi's registry says there is no API key, and never swaps in the local model", async () => {
  const folder = await useTempFolder()
  const { access, created } = recordingLocalAccess("cached")
  const runtime = new SemanticRuntime(join(folder, "models"), access)
  const { context } = fakePiContext(folder, {})
  runtime.attach(context)

  expect(await runtime.source(google)).toEqual({ available: false, reason: "no API key for google" })
  expect(created).toEqual([])
})

test("an empty API key counts as no API key", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { emptyApiKeys: ["openai"] })
  runtime.attach(context)

  expect(await runtime.source(openai)).toEqual({ available: false, reason: "no API key for openai" })
})

test("after shutdown the runtime has no registry left to take a key from", async () => {
  const folder = await useTempFolder()
  const runtime = new SemanticRuntime(join(folder, "models"))
  const { context } = fakePiContext(folder, { apiKeys: ["openai"] })
  runtime.attach(context)
  await runtime.shutdown()

  expect(await runtime.source(openai)).toEqual({ available: false, reason: "no API key for openai" })
})

test.each(["cached", "missing"] as const)(
  "a %s local model is created with only its cache path, and nothing is asked",
  async (status) => {
    const folder = await useTempFolder()
    const { access, created } = recordingLocalAccess(status)
    const runtime = new SemanticRuntime(join(folder, "models"), access)
    const { context, prompts } = fakePiContext(folder, {})
    runtime.attach(context)

    const port = await runtime.source(local)

    expect(port).toMatchObject({ available: true })
    expect(prompts).toEqual([])
    expect(created).toEqual([{ cachePath: join(folder, "models") }])
  },
)

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
