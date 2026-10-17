import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { createLocalEmbedder } from "#src/services"
import { embeddingOperation } from "#test-helpers"

describe("createLocalEmbedder", () => {
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
})
