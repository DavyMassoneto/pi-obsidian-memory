import { mkdir } from "node:fs/promises"

import { expect, test } from "vitest"

import { checkMemoryConfig } from "#src/usecases"
import { registrationUsecaseFixture, writeRegistrationSnapshot } from "#test-helpers"

test("a missing config is reported as not configured", async () => {
  const { context } = await registrationUsecaseFixture()

  expect(await checkMemoryConfig(context)).toMatchObject({ succeeded: false, reason: "not-configured" })
})

test("an invalid config reports every problem", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, limits: { maxBodyChars: -1 } }))

  const result = await checkMemoryConfig(context)

  expect(result).toMatchObject({ succeeded: false, reason: "invalid-config" })
  if (result.succeeded) throw new Error("expected a refusal")
  expect(result.problems.length).toBeGreaterThan(1)
})

test("a config that cannot be read is reported as unreadable", async () => {
  const { context } = await registrationUsecaseFixture()
  await mkdir(context.configPath, { recursive: true })

  expect(await checkMemoryConfig(context)).toMatchObject({ succeeded: false, reason: "unreadable" })
})

test("a valid config is returned", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await writeRegistrationSnapshot(context, JSON.stringify(config))

  expect(await checkMemoryConfig(context)).toEqual({ succeeded: true, output: config })
})
