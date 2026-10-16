import { join } from "node:path"

import { expect, test } from "vitest"

import { collectVaults } from "#src/usecases"
import { exportFixture, holdFileContentsLocked, noteWithId, putCatalogFile, resolvedMemoryOf } from "#test-helpers"

test("each vault's non-hidden, non-temporary files are collected, attachments and index.md included", async () => {
  const { context } = await exportFixture()

  const collected = await collectVaults(await resolvedMemoryOf(context))

  expect(collected.problems).toEqual([])
  expect(collected.global.map((file) => file.path).sort()).toEqual([
    "Ação é.md",
    "Memory.base",
    "_templates/rule.md",
    "archive/tools/Old.md",
    "attachments/diagram.png",
    "index.md",
    "tools/Use pnpm.md",
  ])
  expect(collected.project?.map((file) => file.path)).toEqual(["Deploy.md"])
})

test("without a registered project there is no project list", async () => {
  const { context, root } = await exportFixture()

  const collected = await collectVaults(await resolvedMemoryOf({ ...context, workingFolder: root }))

  expect(collected.project).toBeNull()
})

test("an unreadable file is a problem that names its vault and path, while the other files are still collected", async () => {
  const { context, vault } = await exportFixture()
  await putCatalogFile(vault, "tools/Locked.md", noteWithId(4, "Locked.", []))
  const release = await holdFileContentsLocked(join(vault.path, "tools", "Locked.md"))

  const collected = await collectVaults(await resolvedMemoryOf(context))
  await release()

  expect(collected.problems).toEqual([expect.stringMatching(/^global: tools\/Locked\.md: /)])
  expect(collected.project?.map((file) => file.path)).toEqual(["Deploy.md"])
})
