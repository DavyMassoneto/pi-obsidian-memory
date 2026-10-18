import { expect, test } from "vitest"

import { captureSettings } from "#src/usecases"
import {
  captureFixture,
  DEFAULT_CADENCE,
  expectRegistrationLeaseReleased,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("the capture settings are the six cadence settings of the config on disk", async () => {
  const { context } = await captureFixture()

  expect(await captureSettings(context)).toEqual({ succeeded: true, output: DEFAULT_CADENCE })
  await expectRegistrationLeaseReleased(context)
})

test("a config on disk that still says capture.when keeps working with the mapped settings", async () => {
  const { context, config } = await captureFixture()
  const legacy = { ...config, capture: { model: config.capture.model, when: "on-compaction" } }
  await writeRegistrationSnapshot(context, JSON.stringify(legacy))

  expect(await captureSettings(context)).toEqual({
    succeeded: true,
    output: { ...DEFAULT_CADENCE, reviewEnabled: false, flushOnShutdown: false },
  })
})

test("without a config there are no capture settings", async () => {
  const { context } = await captureFixture()
  await writeRegistrationSnapshot(context, "")

  expect((await captureSettings(context)).succeeded).toBe(false)
  await expectRegistrationLeaseReleased(context)
})
