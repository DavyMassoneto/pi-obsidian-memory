import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { inspectModelAsset } from "#/services"
import { embeddingOperation, syntheticModelAsset } from "#test-helpers"

describe("inspectModelAsset", () => {
  it("distinguishes missing, nonfile, valid, wrong-size and same-size wrong-hash assets", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asset-inspection-"))
    const path = join(directory, "config.json")
    const asset = syntheticModelAsset("correct")
    const signal = embeddingOperation().signal
    try {
      expect(await inspectModelAsset(path, asset, signal)).toBe("missing")
      expect(await inspectModelAsset(directory, asset, signal)).toBe("invalid")
      await writeFile(path, "correct")
      expect(await inspectModelAsset(path, asset, signal)).toBe("valid")
      await writeFile(path, "short")
      expect(await inspectModelAsset(path, asset, signal)).toBe("invalid")
      await writeFile(path, "corrupt")
      expect(await inspectModelAsset(path, asset, signal)).toBe("invalid")
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
