import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createLocalEmbedder, type EmbeddingBatchRequest, loadLocalModel } from "#src/services"
import { controlledLocalModelLoader, embeddingOperation } from "#test-helpers"

describe("createLocalEmbedder loading", () => {
  it("retries a failed first load only on a later call and reuses the successful model", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-retry-"))
    const model = controlledLocalModelLoader()
    const embedder = createLocalEmbedder({ cachePath, downloadConsent: false, loadModel: model.loader })
    const request: EmbeddingBatchRequest = { purpose: "query", inputs: [{ key: "q", text: "retry" }] }
    try {
      const failed = embedder.embed(embeddingOperation(), request)
      await model.started
      model.firstLoad.reject(new Error("transient loader failure"))
      expect(await failed).toEqual({ succeeded: false, status: "unavailable" })
      expect(model.loads).toHaveLength(1)

      const result = await embedder.embed(embeddingOperation(), request)
      expect(result).toMatchObject({
        succeeded: true,
        output: { dimensions: 384, items: [{ key: "q", vector: [1, ...Array<number>(383).fill(0)] }] },
      })
      expect(await embedder.embed(embeddingOperation(), request)).toEqual(result)
      expect(model.loads).toHaveLength(2)
      expect(model.next.texts).toEqual(["query: retry", "query: retry"])
      expect(model.next.disposalCount()).toBe(0)
      expect(await readdir(cachePath)).toEqual([])
    } finally {
      await embedder.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
    expect(model.next.disposalCount()).toBe(1)
  })

  it("does not replay a cancelled load rejection for a fresh signal", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-cancel-retry-"))
    const model = controlledLocalModelLoader()
    const embedder = createLocalEmbedder({ cachePath, downloadConsent: false, loadModel: model.loader })
    const controller = new AbortController()
    const request: EmbeddingBatchRequest = { purpose: "query", inputs: [{ key: "q", text: "fresh" }] }
    try {
      const cancelled = embedder.embed({ ...embeddingOperation(), signal: controller.signal }, request)
      await model.started
      controller.abort()
      expect(await cancelled).toEqual({ succeeded: false, status: "aborted" })
      expect(model.loads[0]?.signal.aborted).toBe(true)
      expect(model.loads).toHaveLength(1)

      const fresh = embeddingOperation()
      const retried = embedder.embed(fresh, request)
      model.firstLoad.resolve(loadLocalModel({ cachePath, downloadConsent: false, signal: controller.signal }))
      expect(await retried).toMatchObject({
        succeeded: true,
        output: { items: [{ key: "q", vector: [1, ...Array<number>(383).fill(0)] }] },
      })
      expect(fresh.signal.aborted).toBe(false)
      expect(model.loads).toHaveLength(2)
      expect(model.loads[1]?.signal.aborted).toBe(false)
      expect(model.next.texts).toEqual(["query: fresh"])
      expect(await readdir(cachePath)).toEqual([])
    } finally {
      await embedder.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
    expect(model.next.disposalCount()).toBe(1)
  })

  it("disposes a cancelled late load before a queued fresh load starts", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-late-load-"))
    const model = controlledLocalModelLoader()
    const embedder = createLocalEmbedder({ cachePath, downloadConsent: false, loadModel: model.loader })
    const controller = new AbortController()
    const request: EmbeddingBatchRequest = { purpose: "query", inputs: [{ key: "q", text: "fresh" }] }
    try {
      const cancelled = embedder.embed({ ...embeddingOperation(), signal: controller.signal }, request)
      await model.started
      controller.abort()
      expect(await cancelled).toEqual({ succeeded: false, status: "aborted" })

      const retried = embedder.embed(embeddingOperation(), request)
      await Promise.resolve()
      expect(model.loads).toHaveLength(1)
      expect(model.first.disposalCount()).toBe(0)
      model.firstLoad.resolve(model.first.model)
      expect(await retried).toMatchObject({
        succeeded: true,
        output: { items: [{ key: "q", vector: [1, ...Array<number>(383).fill(0)] }] },
      })
      expect(model.loads).toHaveLength(2)
      expect(model.disposalsBeforeNextLoad).toEqual([1])
      expect(model.first.texts).toEqual([])
      expect(model.first.disposalCount()).toBe(1)
      expect(model.next.texts).toEqual(["query: fresh"])
      expect(await embedder.embed(embeddingOperation(), request)).toMatchObject({ succeeded: true })
      expect(model.loads).toHaveLength(2)
      expect(await readdir(cachePath)).toEqual([])
    } finally {
      await embedder.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
    expect(model.first.disposalCount()).toBe(1)
    expect(model.next.disposalCount()).toBe(1)
  })

  it("waits for a late load during disposal without extracting or loading queued requests", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "embedding-dispose-load-"))
    const model = controlledLocalModelLoader()
    const embedder = createLocalEmbedder({ cachePath, downloadConsent: false, loadModel: model.loader })
    const request: EmbeddingBatchRequest = { purpose: "query", inputs: [{ key: "q", text: "closed" }] }
    try {
      const pending = embedder.embed(embeddingOperation(), request)
      await model.started
      const queued = embedder.embed(embeddingOperation(), request)
      let disposed = false
      const disposing = embedder.dispose().then(() => {
        disposed = true
      })
      await Promise.resolve()
      expect(disposed).toBe(false)
      model.firstLoad.resolve(model.first.model)
      expect(await pending).toEqual({ succeeded: false, status: "unavailable" })
      expect(await queued).toEqual({ succeeded: false, status: "unavailable" })
      await disposing
      expect(disposed).toBe(true)
      expect(model.first.texts).toEqual([])
      expect(model.first.disposalCount()).toBe(1)
      expect(model.loads).toHaveLength(1)
      expect(await embedder.embed(embeddingOperation(), request)).toEqual({ succeeded: false, status: "unavailable" })
      expect(await readdir(cachePath)).toEqual([])
    } finally {
      await embedder.dispose()
      await rm(cachePath, { recursive: true, force: true })
    }
    expect(model.first.disposalCount()).toBe(1)
  })
})
