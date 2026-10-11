import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { provisionModelAsset } from "#/services"
import { embeddingOperation, embeddingServer, syntheticAssetTransport, syntheticModelAsset } from "#test-helpers"

describe("provisionModelAsset", () => {
  it("downloads only after consent, verifies bytes and leaves no temporary file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "model-asset-"))
    const body = "synthetic model bytes"
    const server = await embeddingServer([body])
    const context = {
      directory,
      asset: syntheticModelAsset(body),
      downloadConsent: false,
      signal: embeddingOperation().signal,
      transport: syntheticAssetTransport(server.endpoint),
    }
    try {
      expect(await provisionModelAsset(context)).toEqual({ succeeded: false, status: "unavailable" })
      expect(server.requests).toHaveLength(0)
      const result = await provisionModelAsset({ ...context, downloadConsent: true })
      expect(result.succeeded).toBe(true)
      expect(await readFile(join(directory, "config.json"), "utf8")).toBe(body)
      expect(await readdir(directory)).toEqual(["config.json"])
      expect((await provisionModelAsset(context)).succeeded).toBe(true)
      expect(server.requests).toHaveLength(1)
      expect(server.requests[0]?.headers.authorization).toBeUndefined()
      expect(server.requests[0]?.headers.cookie).toBeUndefined()
    } finally {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.each(["short", "corrupt bytes with same size"])("refuses corrupt downloads", async (body) => {
    const directory = await mkdtemp(join(tmpdir(), "model-asset-"))
    const server = await embeddingServer([body])
    try {
      const result = await provisionModelAsset({
        directory,
        asset: syntheticModelAsset("correct bytes with same size"),
        downloadConsent: true,
        signal: embeddingOperation().signal,
        transport: syntheticAssetTransport(server.endpoint),
      })
      expect(result).toEqual({ succeeded: false, status: "unavailable" })
      expect(await readdir(directory)).toEqual([])
    } finally {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("does not overwrite an invalid preexisting asset even with consent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "model-asset-"))
    const server = await embeddingServer(["correct"])
    try {
      await writeFile(join(directory, "config.json"), "corrupt")
      const result = await provisionModelAsset({
        directory,
        asset: syntheticModelAsset("correct"),
        downloadConsent: true,
        signal: embeddingOperation().signal,
        transport: syntheticAssetTransport(server.endpoint),
      })
      expect(result).toEqual({ succeeded: false, status: "unavailable" })
      expect(await readFile(join(directory, "config.json"), "utf8")).toBe("corrupt")
      expect(server.requests).toHaveLength(0)
    } finally {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("cancels a pending download and never publishes a partial asset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "model-asset-"))
    const server = await embeddingServer(["correct"], 200, 100)
    const controller = new AbortController()
    try {
      const pending = provisionModelAsset({
        directory,
        asset: syntheticModelAsset("correct"),
        downloadConsent: true,
        signal: controller.signal,
        transport: syntheticAssetTransport(server.endpoint),
      })
      setTimeout(() => controller.abort(), 10)
      expect(await pending).toEqual({ succeeded: false, status: "aborted" })
      expect(await readdir(directory)).toEqual([])
    } finally {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it("publishes exclusively when two runtimes race for the same asset", async () => {
    const directory = await mkdtemp(join(tmpdir(), "model-asset-"))
    const server = await embeddingServer(["correct"], 200, 20)
    const request = {
      directory,
      asset: syntheticModelAsset("correct"),
      downloadConsent: true,
      signal: embeddingOperation().signal,
      transport: syntheticAssetTransport(server.endpoint),
    }
    try {
      const results = await Promise.all([provisionModelAsset(request), provisionModelAsset(request)])
      expect(results.every((result) => result.succeeded)).toBe(true)
      expect(await readFile(join(directory, "config.json"), "utf8")).toBe("correct")
      expect(await readdir(directory)).toEqual(["config.json"])
    } finally {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
