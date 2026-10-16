import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { checkLocalModel, createLocalSemantic } from "#src/usecases"
import { useTempFolder } from "#test-helpers"

const signal = new AbortController().signal

test("an empty cache is a missing model", async () => {
  const folder = await useTempFolder()

  expect(await checkLocalModel(join(folder, "models"), signal)).toBe("missing")
})

test("a model file that is not the published one is an invalid model", async () => {
  const folder = await useTempFolder()
  const directory = join(
    folder,
    "models",
    "Xenova",
    "multilingual-e5-small",
    "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  )
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "config.json"), "tampered")

  expect(await checkLocalModel(join(folder, "models"), signal)).toBe("invalid")
})

test("the local port embeds through the local embedder and is unavailable without a usable cache path", async () => {
  const local = createLocalSemantic({ cachePath: "" })

  const result = await local.port.embed(
    { purpose: "query", inputs: [{ key: "q", text: "car" }] },
    { signal, timeoutMs: 1000 },
  )
  await local.dispose()

  expect(local.port.available).toBe(true)
  expect(result).toEqual({ succeeded: false, status: "unavailable" })
})
