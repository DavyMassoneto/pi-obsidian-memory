import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createLocalEmbedder } from "#src/services"
import { embeddingOperation, localModelDouble } from "#test-helpers"

describe("createLocalEmbedder", () => {
  it("loads lazily once and prefixes both purposes", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-test-"))
    const model = localModelDouble()
    const embedder = createLocalEmbedder({ cachePath, loadModel: model.loader })
    try {
      expect(model.loads).toHaveLength(0)
      const query = await embedder.embed(embeddingOperation(), {
        purpose: "query",
        inputs: [{ key: "q", text: "olá" }],
      })
      const document = await embedder.embed(embeddingOperation(), {
        purpose: "document",
        inputs: [{ key: "d", text: "English note" }],
      })
      expect(query.succeeded).toBe(true)
      expect(document.succeeded).toBe(true)
      expect(model.loads).toEqual([{ cachePath, signal: expect.any(AbortSignal) }])
      expect(model.texts).toEqual(["query: olá", "passage: English note"])
      expect(await readdir(cachePath)).toEqual([])
    } finally {
      await embedder.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
    expect(model.isDisposed()).toBe(true)
  })

  it("chunks with bounded overlap and includes the entire tail without splitting Unicode", async () => {
    const model = localModelDouble()
    const embedder = createLocalEmbedder({
      cachePath: "unused-model-double",
      loadModel: model.loader,
    })
    const text = `${"🌎".repeat(800)}TAIL`
    try {
      const result = await embedder.embed(embeddingOperation(), { purpose: "document", inputs: [{ key: "a", text }] })
      expect(result.succeeded).toBe(true)
      expect(model.texts.length).toBeGreaterThan(1)
      expect(model.texts.every((chunk) => model.model.countTokens(chunk) <= 512)).toBe(true)
      expect(model.texts.at(-1)).toContain("TAIL")
      expect(model.texts.join("")).not.toContain("�")
      const count = model.texts.length
      expect(await embedder.embed(embeddingOperation(), { purpose: "query", inputs: [{ key: "q", text }] })).toEqual({
        succeeded: false,
        status: "input-too-long",
      })
      expect(model.texts).toHaveLength(count)
    } finally {
      await embedder.dispose()
    }
  })

  it("returns unavailable for a corrupt cache without overwriting it", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-offline-"))
    const options = { cachePath }
    const request = { purpose: "query", inputs: [{ key: "a", text: "synthetic" }] } as const
    try {
      const modelPath = join(cachePath, "Xenova", "multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78")
      await mkdir(modelPath, { recursive: true })
      await writeFile(join(modelPath, "config.json"), "corrupt", "utf8")
      const corrupt = createLocalEmbedder(options)
      try {
        expect(await corrupt.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
        expect(await corrupt.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
        expect(await readdir(modelPath)).toEqual(["config.json"])
        expect(await readFile(join(modelPath, "config.json"), "utf8")).toBe("corrupt")
      } finally {
        await corrupt.dispose()
      }
    } finally {
      await rm(cachePath, { recursive: true, force: true })
    }
  })

  it("reports unavailable without exposing loader errors and never falls back", async () => {
    const embedder = createLocalEmbedder({
      cachePath: "unused-model-double",
      loadModel: async () => {
        throw new Error("private-path")
      },
    })
    expect(
      await embedder.embed(embeddingOperation(), { purpose: "query", inputs: [{ key: "a", text: "one" }] }),
    ).toEqual({ succeeded: false, status: "unavailable" })
    await embedder.dispose()
  })
})
