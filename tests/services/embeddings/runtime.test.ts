import { channel } from "node:diagnostics_channel"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadCachedLocalModel, loadLocalModel } from "#src/services"
import { embeddingOperation } from "#test-helpers"

describe("loadLocalModel", () => {
  it("the actual package makes no HTTP requests for an absolute missing local-only directory", async () => {
    const path = await mkdtemp(join(tmpdir(), "inference-offline-"))
    const requests = channel("undici:request:create")
    let count = 0
    const countRequest = () => {
      count += 1
    }
    requests.subscribe(countRequest)
    try {
      await expect(loadCachedLocalModel(path)).rejects.toThrow()
      expect(count).toBe(0)
      expect(await readdir(path)).toEqual([])
    } finally {
      requests.unsubscribe(countRequest)
      await rm(path, { recursive: true, force: true })
    }
  })

  it("does not import or initialize inference with a corrupt cache", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "runtime-cache-"))
    const directory = join(cachePath, "Xenova", "multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78")
    try {
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "config.json"), "corrupt")
      await expect(loadLocalModel({ cachePath, signal: embeddingOperation().signal })).rejects.toMatchObject({
        failure: { succeeded: false, status: "unavailable" },
      })
      expect(await readdir(directory)).toEqual(["config.json"])
    } finally {
      await rm(cachePath, { recursive: true, force: true })
    }
  })
})
