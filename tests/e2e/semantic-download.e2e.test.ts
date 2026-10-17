import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { MODEL_INVALID, memoryModelCachePath, READ_HINT } from "#src/pi"
import {
  CAT_PATH,
  CAT_QUERY,
  downloadLocalModel,
  expectEveryAssetDownloaded,
  foundLine,
  freshWorldWithCat,
  plantDamagedModel,
  searchAnswer,
} from "#test-helpers"

test("with an empty cache the real pi downloads the local model from Hugging Face without asking, every asset matching its pinned size and hash", async () => {
  const world = await freshWorldWithCat()
  const answer = await searchAnswer(world, CAT_QUERY)
  expect(answer).toEqual({ text: foundLine(CAT_PATH), isError: false })
  await expectEveryAssetDownloaded(world)
  expect(world.pi.unexpected).toEqual([])
})

test("a damaged model is refused until its folder is removed, and then the model is downloaded again", async () => {
  const world = await freshWorldWithCat()
  await downloadLocalModel(world)
  await world.pi.stop()
  await plantDamagedModel(world)
  await world.restart()
  const refused = await searchAnswer(world, CAT_QUERY)
  const off = `Semantic search is off: ${MODEL_INVALID}`
  expect(refused).toEqual({
    text: `No notes found in global. ${READ_HINT}\nWarning: ${off}\n${off}`,
    isError: false,
  })
  await world.pi.stop()
  await rm(memoryModelCachePath(world.folders.agentDir), { recursive: true })
  await world.restart()
  const again = await searchAnswer(world, CAT_QUERY)
  expect(again).toEqual({ text: foundLine(CAT_PATH), isError: false })
  await expectEveryAssetDownloaded(world)
})
