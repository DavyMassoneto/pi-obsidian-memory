import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { proposeMemorySetup, setupMemory } from "#src/usecases"
import {
  customizedSettings,
  proposeVaultMode,
  registrationUsecaseFixture,
  setupPreparationOf,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a config missing a key gains its default after setup and every other value stays the same", async () => {
  const { context, config } = await registrationUsecaseFixture()
  const { context: _omitted, ...withoutContext } = { ...config, ...customizedSettings() }
  await mkdir(config.global.vault)
  const expectedHash = await writeRegistrationSnapshot(context, JSON.stringify(withoutContext))
  const preparation = await setupPreparationOf(context, null)

  const proposal = await proposeMemorySetup({ draft: preparation.draft, vault: "", mode: "attach" }, context)
  if (!proposal.succeeded) throw new Error(proposal.problems.join("\n"))
  const result = await setupMemory(
    { config: proposal.output.config, expectedHash, replacementConfirmed: false },
    context,
  )

  expect(result.succeeded).toBe(true)
  expect(JSON.parse(await readFile(context.configPath, "utf8"))).toEqual({
    ...withoutContext,
    context: { budgetChars: 12000 },
  })
})

test("an unresolved chat model is refused", async () => {
  const { context } = await registrationUsecaseFixture()
  const preparation = await setupPreparationOf(context, null)

  const proposal = await proposeMemorySetup(
    { draft: preparation.draft, vault: join(context.workingFolder, "vault"), mode: "create" },
    context,
  )

  expect(proposal.succeeded).toBe(false)
})

test("a blank vault keeps the current global vault and none is refused", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  const kept = await setupPreparationOf(context, null)

  const same = await proposeMemorySetup({ draft: kept.draft, vault: "  ", mode: "attach" }, context)
  expect(same).toMatchObject({ succeeded: true, output: { config: { global: { vault: config.global.vault } } } })

  const fresh = await registrationUsecaseFixture()
  const none = await setupPreparationOf(fresh.context, { provider: "chosen", id: "chat" })
  const refused = await proposeMemorySetup({ draft: none.draft, vault: "", mode: "create" }, fresh.context)
  expect(refused.succeeded).toBe(false)
})

test("a relative vault is resolved against the working folder", async () => {
  const { context } = await registrationUsecaseFixture()
  const preparation = await setupPreparationOf(context, { provider: "chosen", id: "chat" })

  const proposal = await proposeMemorySetup({ draft: preparation.draft, vault: "notes", mode: "create" }, context)

  expect(proposal).toMatchObject({
    succeeded: true,
    output: { config: { global: { vault: join(context.workingFolder, "notes") } } },
  })
})

test("create refuses a populated folder and a file, attach refuses a missing folder and a file", async () => {
  const { root, context } = await registrationUsecaseFixture()
  const preparation = await setupPreparationOf(context, { provider: "chosen", id: "chat" })
  const populated = join(root, "populated")
  const empty = join(root, "empty")
  const file = join(root, "file")
  const missing = join(root, "missing")
  await mkdir(populated)
  await writeFile(join(populated, "note.md"), "x")
  await mkdir(empty)
  await writeFile(file, "x")
  const { draft } = preparation

  expect((await proposeVaultMode(context, draft, populated, "create")).succeeded).toBe(false)
  expect((await proposeVaultMode(context, draft, file, "create")).succeeded).toBe(false)
  expect((await proposeVaultMode(context, draft, missing, "create")).succeeded).toBe(true)
  expect((await proposeVaultMode(context, draft, empty, "create")).succeeded).toBe(true)
  expect((await proposeVaultMode(context, draft, missing, "attach")).succeeded).toBe(false)
  expect((await proposeVaultMode(context, draft, file, "attach")).succeeded).toBe(false)
  expect((await proposeVaultMode(context, draft, populated, "attach")).succeeded).toBe(true)
  expect((await proposeVaultMode(context, draft, empty, "attach")).succeeded).toBe(true)
})

test("the proposal carries the disclosures the chosen settings require", async () => {
  const { context, config } = await registrationUsecaseFixture()
  await mkdir(config.global.vault)
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, ...customizedSettings() }))
  const custom = await setupPreparationOf(context, null)

  const attached = await proposeMemorySetup({ draft: custom.draft, vault: "", mode: "attach" }, context)
  expect(attached).toMatchObject({
    succeeded: true,
    output: { disclosures: ["chat-models", "jev", "remote-embeddings"] },
  })
})
