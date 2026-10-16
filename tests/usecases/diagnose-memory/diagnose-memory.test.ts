import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { diagnoseMemory } from "#src/usecases"
import {
  chatModelPort,
  expectRegistrationLeaseReleased,
  memoryReadTree,
  noteWithId,
  putBrokenVault,
  putCatalogFile,
  searchFixture,
  writeRegistrationSnapshot,
} from "#test-helpers"

const models = [
  { provider: "test-chat", id: "selected-chat" },
  { provider: "other", id: "agent" },
]

test("the doctor changes nothing on disk, in either vault", async () => {
  const { context, vault, project, config } = await searchFixture()
  await putBrokenVault(vault, config.limits.maxNotesPerFolder)
  await putCatalogFile(project, "Deploy.md", noteWithId(40, "Deploy.", []))
  const before = [await memoryReadTree(vault.path), await memoryReadTree(project.path)]

  await diagnoseMemory({ port: chatModelPort(models, []) }, context)

  expect([await memoryReadTree(vault.path), await memoryReadTree(project.path)]).toEqual(before)
})

test("both vaults are reported, a missing project vault is a problem for that vault only", async () => {
  const { context, vault, project } = await searchFixture()
  await putCatalogFile(vault, "Good.md", noteWithId(1, "Fine.", []))
  await rm(project.path, { recursive: true })

  const result = await diagnoseMemory({ port: chatModelPort(models, []) }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      projectMissing: false,
      vaults: [
        { vault: "global", diagnosis: { invalid: [] } },
        { vault: "project", problems: [expect.any(String)] },
      ],
    },
  })
})

test("a folder with no registered project reports projectMissing and only the global vault", async () => {
  const { context, root } = await searchFixture()

  const result = await diagnoseMemory({ port: chatModelPort(models, []) }, { ...context, workingFolder: root })

  expect(result).toMatchObject({ succeeded: true, output: { projectMissing: true, vaults: [{ vault: "global" }] } })
})

test("each configured chat model is checked against pi's registry and credentials", async () => {
  const { context, config } = await searchFixture()
  const memoryAgent = { model: { provider: "other", id: "agent" } }
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, memoryAgent }))

  const allGood = await diagnoseMemory({ port: chatModelPort(models, []) }, context)
  const broken = await diagnoseMemory(
    { port: chatModelPort([{ provider: "test-chat", id: "selected-chat" }], ["test-chat/selected-chat"]) },
    context,
  )

  expect(allGood).toMatchObject({
    output: {
      models: [
        { role: "capture", check: { status: "ok" } },
        { role: "memory agent", check: { status: "ok" } },
      ],
    },
  })
  expect(broken).toMatchObject({
    output: {
      models: [
        { role: "capture", check: { status: "no-credentials" } },
        { role: "memory agent", check: { status: "model-not-found" } },
      ],
    },
  })
})

test("with no config the doctor reports the config problem", async () => {
  const { context } = await searchFixture()
  await rm(context.configPath)

  const result = await diagnoseMemory({ port: chatModelPort(models, []) }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "not-configured" })
  await expectRegistrationLeaseReleased(context)
})
