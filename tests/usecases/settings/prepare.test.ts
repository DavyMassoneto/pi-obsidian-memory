import { mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { changeMemorySettings, prepareMemorySettings } from "#src/usecases"
import {
  customizedSettings,
  expectRegistrationLeaseReleased,
  registrationUsecaseFixture,
  writeRegistrationSnapshot,
  writtenConfig,
} from "#test-helpers"

test("a valid config comes back with its hash", async () => {
  const { context, config } = await registrationUsecaseFixture()
  const hash = await writeRegistrationSnapshot(context, JSON.stringify(config))

  expect(await prepareMemorySettings(context)).toEqual({ succeeded: true, output: { config, hash } })
  await expectRegistrationLeaseReleased(context)
})

test("settings opens a legacy config and saves a change without losing other settings", async () => {
  const { context, config: base } = await registrationUsecaseFixture()
  await mkdir(base.global.vault)
  const config = { ...base, ...customizedSettings() }
  const text = JSON.stringify({ ...config, limits: { ...config.limits, maxNotesPerFolder: 37 } }, null, 2)
  const hash = await writeRegistrationSnapshot(context, text)

  expect(await prepareMemorySettings(context)).toEqual({ succeeded: true, output: { config, hash } })
  expect(await readFile(context.configPath, "utf8")).toBe(text)
  const changed = await changeMemorySettings(
    { change: { kind: "budgetChars", value: 8765 }, expectedHash: hash },
    context,
  )
  expect(changed.succeeded).toBe(true)
  expect(await writtenConfig(context.configPath)).toEqual({ ...config, context: { budgetChars: 8765 } })
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
