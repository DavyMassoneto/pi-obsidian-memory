import { rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { cycleSettings } from "#src/usecases"
import {
  customizedSettings,
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a valid config gives the observer and compaction settings", async () => {
  const { context, config } = await memoryReadFixture()
  const custom = customizedSettings()
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, ...custom }))

  expect(await cycleSettings(context)).toEqual({
    succeeded: true,
    output: { observer: custom.observer, compaction: custom.compaction },
  })
  await expectRegistrationLeaseReleased(context)
})

test("with no config the settings are refused as not configured", async () => {
  const { context } = await memoryReadFixture()
  await rm(context.configPath)

  expect(await cycleSettings(context)).toMatchObject({ succeeded: false, reason: "not-configured" })
  await expectRegistrationLeaseReleased(context)
})

test("an invalid config is refused with its problems", async () => {
  const { root, context, config } = await memoryReadFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, global: { vault: join(root, "unavailable") }, extra: true }),
  )

  expect(await cycleSettings(context)).toMatchObject({
    succeeded: false,
    reason: "invalid-config",
    problems: [expect.any(String)],
  })
  await expectRegistrationLeaseReleased(context)
})
