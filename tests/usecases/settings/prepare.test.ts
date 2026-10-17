import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { prepareMemorySettings } from "#src/usecases"
import { expectRegistrationLeaseReleased, registrationUsecaseFixture, writeRegistrationSnapshot } from "#test-helpers"

test("a valid config comes back with its hash", async () => {
  const { context, config } = await registrationUsecaseFixture()
  const hash = await writeRegistrationSnapshot(context, JSON.stringify(config))

  expect(await prepareMemorySettings(context)).toEqual({ succeeded: true, output: { config, hash } })
  await expectRegistrationLeaseReleased(context)
})

test("no config is refused as not configured, so the user is sent to the wizard", async () => {
  const { context } = await registrationUsecaseFixture()

  expect(await prepareMemorySettings(context)).toMatchObject({ succeeded: false, reason: "not-configured" })
})

test("an invalid config is refused as invalid, with its problems", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, limits: { maxBodyChars: -1 } }))

  expect(await prepareMemorySettings(context)).toMatchObject({
    succeeded: false,
    reason: "invalid-config",
    problems: expect.arrayContaining([expect.stringContaining("maxBodyChars")]),
  })
  await expectRegistrationLeaseReleased(context)
})

test("a config path that cannot be read is refused as unreadable", async () => {
  const { context } = await registrationUsecaseFixture()
  await mkdir(join(context.configPath), { recursive: true })

  expect(await prepareMemorySettings(context)).toMatchObject({ succeeded: false, reason: "unreadable" })
})
