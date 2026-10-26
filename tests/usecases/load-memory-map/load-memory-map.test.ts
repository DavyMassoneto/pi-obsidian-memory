import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { loadMemoryMap } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteWithId,
  putCatalogFile,
  searchFixture,
} from "#test-helpers"

test("every note that is not archived is listed with its path, type and don't forget mark", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", ["dontForget: true"]))
  await putCatalogFile(vault, "tools/Plain.md", noteWithId(2, "Nothing special.", []))

  expect(await loadMemoryMap(context)).toEqual({
    succeeded: true,
    output: [
      {
        vault: "global",
        name: "global",
        notes: [
          { path: "tools/Plain.md", type: "rule", dontForget: false },
          { path: "tools/Use pnpm.md", type: "rule", dontForget: true },
        ],
        problems: [],
      },
    ],
  })
})

test("archived notes are left out", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "Keep.md", noteWithId(1, "Keep it.", []))
  await putCatalogFile(vault, "Old.md", noteWithId(2, "Old.", []))
  await mkdir(join(vault.path, "archive"))
  await rename(join(vault.path, "Old.md"), join(vault.path, "archive/Old.md"))

  expect(await loadMemoryMap(context)).toMatchObject({
    succeeded: true,
    output: [{ notes: [{ path: "Keep.md" }] }],
  })
})

test("the project vault comes first when the folder has one", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "Global.", []))
  await putCatalogFile(project, "Project.md", noteWithId(2, "Project.", []))

  expect(await loadMemoryMap(context)).toMatchObject({
    succeeded: true,
    output: [
      { vault: "project", name: "loja-vault", notes: [{ path: "Project.md" }] },
      { vault: "global", notes: [{ path: "Global.md" }] },
    ],
  })
})

test("a note added on disk since the last sync is listed", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "First.md", noteWithId(1, "First.", []))
  expect(await loadMemoryMap(context)).toMatchObject({ output: [{ notes: [{ path: "First.md" }] }] })

  await putCatalogFile(vault, "Second.md", noteWithId(2, "Second.", []))

  expect(await loadMemoryMap(context)).toMatchObject({
    output: [{ notes: [{ path: "First.md" }, { path: "Second.md" }] }],
  })
})

test("a vault whose index cannot be opened is reported with its problem and the other vault is still listed", async () => {
  const { vault, project, context } = await searchFixture()
  await putCatalogFile(vault, "Global.md", noteWithId(1, "Global.", []))
  await rm(project.path, { recursive: true })

  expect(await loadMemoryMap(context)).toMatchObject({
    succeeded: true,
    output: [
      { vault: "project", notes: [], problems: [expect.any(String)] },
      { vault: "global", notes: [{ path: "Global.md" }], problems: [] },
    ],
  })
})

test("the session lease is released", async () => {
  const { context } = await memoryReadFixture()

  await loadMemoryMap(context)

  await expectRegistrationLeaseReleased(context)
})
