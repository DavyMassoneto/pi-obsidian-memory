import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { provisionLocalModel } from "#/services"
import { embeddingOperation } from "#test-helpers"

describe("provisionLocalModel", () => {
  it("rejects relative cache paths without touching disk", async () => {
    expect(
      await provisionLocalModel({ cachePath: "relative", downloadConsent: false, signal: embeddingOperation().signal }),
    ).toEqual({ succeeded: false, status: "unavailable" })
  })

  it("requires the pinned manifest and refuses an existing corrupted file even with consent", async () => {
    const cachePath = await mkdtemp(join(tmpdir(), "model-cache-"))
    const directory = join(cachePath, "Xenova", "multilingual-e5-small", "761b726dd34fb83930e26aab4e9ac3899aa1fa78")
    try {
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, "config.json"), "x".repeat(658))
      expect(
        await provisionLocalModel({ cachePath, downloadConsent: true, signal: embeddingOperation().signal }),
      ).toEqual({ succeeded: false, status: "unavailable" })
      expect(await readFile(join(directory, "config.json"), "utf8")).toBe("x".repeat(658))
      expect(await readdir(directory)).toEqual(["config.json"])
    } finally {
      await rm(cachePath, { recursive: true, force: true })
    }
  })
})
