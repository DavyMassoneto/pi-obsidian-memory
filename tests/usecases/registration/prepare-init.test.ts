import { join } from "node:path"

import { expect, test } from "vitest"

import { checkProjectName, prepareProjectInit } from "#src/usecases"
import { customizedSettings, registrationUsecaseFixture, writeRegistrationSnapshot } from "#test-helpers"

test("without a config init is refused and points to the config path", async () => {
  const { context } = await registrationUsecaseFixture()

  expect(await prepareProjectInit(context)).toEqual({
    succeeded: false,
    reason: "not-configured",
    configPath: context.configPath,
    problems: ["memory is not configured"],
  })
})

test("an invalid config is refused with every problem", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, limits: { maxBodyChars: -1 }, capture: { when: "never" } }),
  )

  const result = await prepareProjectInit(context)

  expect(result).toMatchObject({ succeeded: false, reason: "invalid-config", configPath: context.configPath })
  if (result.succeeded) throw new Error("expected a refusal")
  expect(result.problems.length).toBeGreaterThan(1)
})

test("an unregistered folder gets the folder name as default and the hash to publish against", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const other = { name: "Other", folder: join(root, "other"), vault: join(root, "other-vault") }
  const expectedHash = await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, ...customizedSettings(), projects: [other] }),
  )

  expect(await prepareProjectInit(context)).toEqual({
    succeeded: true,
    output: { expectedHash, existing: null, defaultName: "work", takenNames: ["Other"] },
  })
})

test("a subfolder of a registered project reports that project and does not count its name as taken", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const registered = { name: "Loja", folder: context.workingFolder, vault: join(root, "loja") }
  const other = { name: "Other", folder: join(root, "other"), vault: join(root, "other-vault") }
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [registered, other] }))

  const result = await prepareProjectInit({ ...context, workingFolder: join(context.workingFolder, "src") })

  expect(result).toMatchObject({
    succeeded: true,
    output: { existing: registered, defaultName: "Loja", takenNames: ["Other"] },
  })
})

test("a blank name means the default and names taken in any case are refused", async () => {
  const { root, context, config } = await registrationUsecaseFixture()
  const other = { name: "Loja", folder: join(root, "other"), vault: join(root, "other-vault") }
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, projects: [other] }))
  const preparation = await prepareProjectInit(context)
  if (!preparation.succeeded) throw new Error("preparation failed")

  expect(checkProjectName(preparation.output, "  ")).toEqual({ succeeded: true, output: "work" })
  expect(checkProjectName(preparation.output, " Shop ")).toEqual({ succeeded: true, output: "Shop" })
  expect(checkProjectName(preparation.output, "lOJA")).toMatchObject({ succeeded: false })
})
