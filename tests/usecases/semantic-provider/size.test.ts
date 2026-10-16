import { expect, test } from "vitest"

import { localModelAssets } from "#src/services"
import { localModelDownloadBytes, localModelDownloadMegabytes } from "#src/usecases"

test("the download size is the sum of every model file, about 135 MB", () => {
  expect(localModelDownloadBytes()).toBe(localModelAssets.reduce((sum, asset) => sum + asset.bytes, 0))
  expect(localModelDownloadBytes()).toBeGreaterThan(130_000_000)
  expect(localModelDownloadBytes()).toBeLessThan(140_000_000)
})

test("the size shown to the user is that sum in whole megabytes", () => {
  expect(localModelDownloadMegabytes()).toBe(Math.round(localModelDownloadBytes() / 1_000_000))
  expect(localModelDownloadMegabytes()).toBeGreaterThan(100)
})
