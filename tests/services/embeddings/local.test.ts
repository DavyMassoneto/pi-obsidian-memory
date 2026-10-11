import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createLocalEmbedder } from "#/services"
import { embeddingOperation, localModelDouble } from "#test-helpers"

describe("createLocalEmbedder", () => {
  it("loads lazily once, stays offline without consent and prefixes both purposes", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-test-"))
    const model = localModelDouble()
    const embedder = createLocalEmbedder({ cachePath, downloadConsent: false, loadModel: model.loader })
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
      expect(model.loads).toEqual([{ cachePath, downloadConsent: false, signal: expect.any(AbortSignal) }])
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
      downloadConsent: true,
      loadModel: model.loader,
    })
    const text = `${"🌎".repeat(800)}TAIL`
    try {
      const result = await embedder.embed(embeddingOperation(), { purpose: "document", inputs: [{ key: "a", text }] })
      expect(result.succeeded).toBe(true)
      expect(model.loads[0]?.downloadConsent).toBe(true)
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

  it("captures consent once instead of accepting later mutation of caller options", async () => {
    const model = localModelDouble()
    const options = { cachePath: "unused-model-double", downloadConsent: false, loadModel: model.loader }
    const embedder = createLocalEmbedder(options)
    options.downloadConsent = true
    try {
      await embedder.embed(embeddingOperation(), { purpose: "query", inputs: [{ key: "a", text: "one" }] })
      expect(model.loads[0]?.downloadConsent).toBe(false)
    } finally {
      await embedder.dispose()
    }
  })

  it("returns unavailable for a real missing or corrupt offline cache without downloading", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-offline-"))
    const options = { cachePath, downloadConsent: false }
    const request = { purpose: "query", inputs: [{ key: "a", text: "synthetic" }] } as const
    const missing = createLocalEmbedder(options)
    try {
      expect(await missing.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
      expect(await readdir(cachePath)).toEqual([])
      const modelPath = join(cachePath, "Xenova", "multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78")
      await mkdir(modelPath, { recursive: true })
      await writeFile(join(modelPath, "config.json"), "corrupt", "utf8")
      const corrupt = createLocalEmbedder(options)
      try {
        expect(await corrupt.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
        expect(await readdir(modelPath)).toEqual(["config.json"])
      } finally {
        await corrupt.dispose()
      }
    } finally {
      await missing.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
  })

  it("reports unavailable without exposing loader errors and never falls back", async () => {
    const embedder = createLocalEmbedder({
      cachePath: "unused-model-double",
      downloadConsent: false,
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
