import { mkdtemp, open, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { downloadModelAsset } from "#src/services"
import { embeddingOperation, embeddingServer, syntheticAssetTransport, syntheticModelAsset } from "#test-helpers"

describe("downloadModelAsset", () => {
  it.each([200, 401])("enforces the manifest byte limit for HTTP %s", async (status) => {
    const directory = await mkdtemp(join(tmpdir(), "asset-download-"))
    const path = join(directory, "asset.tmp")
    const file = await open(path, "wx")
    const server = await embeddingServer(["too much data"], status)
    try {
      const result = await downloadModelAsset(
        {
          directory,
          asset: syntheticModelAsset("small"),
          downloadConsent: true,
          signal: embeddingOperation().signal,
          transport: syntheticAssetTransport(server.endpoint),
        },
        file,
      )
      expect(result).toBe(false)
      expect(await readFile(path, "utf8")).toBe("")
    } finally {
      await file.close()
      await server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
