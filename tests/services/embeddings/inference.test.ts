import { describe, expect, it, vi } from "vitest"

import { loadCachedLocalModel } from "#/services"
import { syntheticDispose, syntheticEncode, syntheticExtraction, syntheticPipeline } from "#test-helpers"

vi.mock("@huggingface/transformers", async () => {
  const { syntheticPipeline } = await import("#test-helpers")
  return { pipeline: syntheticPipeline }
})

describe("loadCachedLocalModel", () => {
  it("uses a prepared absolute model directory with CPU q8 and strictly local-only inference", async () => {
    const path = "C:/synthetic-cache/Xenova/multilingual-e5-small/761b726dd34fb83930e26aab4e9ac3899aa1fa78"
    const model = await loadCachedLocalModel(path)
    expect(syntheticPipeline).toHaveBeenLastCalledWith("feature-extraction", path, {
      device: "cpu",
      dtype: "q8",
      local_files_only: true,
      cache_dir: path,
    })
    expect(model.countTokens("query: hi")).toBe(9)
    expect(syntheticEncode).toHaveBeenLastCalledWith("query: hi", { add_special_tokens: true })
    expect(await model.extract("query: hi")).toHaveLength(384)
    expect(syntheticExtraction).toHaveBeenLastCalledWith("query: hi", { pooling: "mean", normalize: true })
    await model.dispose()
    expect(syntheticDispose).toHaveBeenCalledOnce()
  })

  it("refuses an unexpected tensor shape", async () => {
    const model = await loadCachedLocalModel("C:/synthetic-cache")
    syntheticExtraction.mockResolvedValueOnce({ dims: [1, 768], data: new Float32Array(768) })
    expect(await model.extract("query: hi")).toBeNull()
    await model.dispose()
  })
})
