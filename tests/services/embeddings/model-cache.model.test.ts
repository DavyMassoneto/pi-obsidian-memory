import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectModelAsset, localModelAssets, provisionLocalModel } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("downloads the local model from Hugging Face into an empty cache, every asset matching its pinned size and hash", async () => {
  const cachePath = await useTempFolder()
  const signal = new AbortController().signal
  const first = await provisionLocalModel({ cachePath, signal })
  if (!first.succeeded) throw new Error(`download failed: ${first.status}`)
  for (const asset of localModelAssets) {
    expect(await inspectModelAsset(join(first.output, asset.path), asset, signal)).toBe("valid")
  }
  const [config] = localModelAssets
  if (!config) throw new Error("no assets pinned")
  const configPath = join(first.output, config.path)
  expect(await inspectModelAsset(join(first.output, "absent.json"), config, signal)).toBe("missing")
  await writeFile(configPath, Buffer.alloc(config.bytes, 32))
  expect(await inspectModelAsset(configPath, config, signal)).toBe("invalid")
  await writeFile(configPath, "{}")
  expect(await inspectModelAsset(configPath, config, signal)).toBe("invalid")
  expect(await provisionLocalModel({ cachePath, signal })).toEqual({ succeeded: false, status: "unavailable" })
  await rm(first.output, { recursive: true })
  await mkdir(cachePath, { recursive: true })
  const again = await provisionLocalModel({ cachePath, signal })
  expect(again.succeeded).toBe(true)
  expect(await inspectModelAsset(configPath, config, signal)).toBe("valid")
})
