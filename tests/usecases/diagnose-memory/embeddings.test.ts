import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { checkEmbeddings } from "#src/usecases"
import { embeddingProbe, useTempFolder } from "#test-helpers"

const local = { provider: "local", model: "Xenova/multilingual-e5-small" } as const
const openai = { provider: "openai", model: "text-embedding-3-small" } as const
const google = { provider: "google", model: "gemini-embedding-001" } as const

test("a local model that is not downloaded yet says how big it is and that it is downloaded on first use", async () => {
  const folder = await useTempFolder()

  const report = await checkEmbeddings(local, embeddingProbe(join(folder, "models"), []), new AbortController().signal)

  expect(report).toMatchObject({
    provider: "local",
    model: "Xenova/multilingual-e5-small",
    status: "model-not-downloaded",
  })
  expect(report).toMatchObject({ problem: expect.stringMatching(/not downloaded.*\d+ MB.*downloaded on/) })
})

test("a damaged local model file is reported as damaged", async () => {
  const folder = await useTempFolder()
  const models = join(folder, "models")
  const directory = join(models, "Xenova", "multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78")
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "config.json"), "not the real file")

  const report = await checkEmbeddings(local, embeddingProbe(models, []), new AbortController().signal)

  expect(report.status).toBe("model-damaged")
})

test.each([openai, google])("a remote provider with credentials is ready ($provider)", async (configuration) => {
  const probe = embeddingProbe("unused", [configuration.provider])

  const report = await checkEmbeddings(configuration, probe, new AbortController().signal)

  expect(report).toEqual({ provider: configuration.provider, model: configuration.model, status: "ready" })
})

test.each([openai, google])("a remote provider without credentials says so ($provider)", async (configuration) => {
  const report = await checkEmbeddings(configuration, embeddingProbe("unused", []), new AbortController().signal)

  expect(report).toMatchObject({ status: "no-credentials", problem: `No API key for ${configuration.provider}` })
})
