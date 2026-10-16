import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { reportVault } from "#src/usecases"
import { noteWithId, putBrokenVault, putCatalogFile, resolvedFixture } from "#test-helpers"

test("a vault with a broken note, a copied note, a blank note, a leftover temporary file and an oversized folder gets one report naming all five", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putBrokenVault(vault, memory.config.limits.maxNotesPerFolder)

  const report = await reportVault(memory, memory.global, context)

  expect(report).toMatchObject({
    vault: "global",
    diagnosis: {
      invalid: [{ path: "tools/Broken.md", problems: [expect.stringContaining("colour")] }],
      blank: ["Blank.md"],
      duplicateIds: [{ paths: ["copies/Copy one.md", "copies/Copy two.md"] }],
      temporaries: ["tools/Half.md.tmp-abc"],
      crowdedFolders: [{ folder: "crowded", count: memory.config.limits.maxNotesPerFolder + 1 }],
    },
    blanks: [{ path: "Blank.md", empty: true, rawHash: expect.any(String) }],
    unreadable: [],
  })
})

test("a blank file with text is reported as blank but not empty", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putCatalogFile(vault, "Typed.md", "Some text with no frontmatter")

  const report = await reportVault(memory, memory.global, context)

  expect(report).toMatchObject({ blanks: [{ path: "Typed.md", empty: false }] })
})

test("folder indexes, templates and the dashboard are not mistaken for blank notes or unreadable files", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putCatalogFile(vault, "index.md", "# Global memory\n")
  await putCatalogFile(vault, "_templates/rule.md", "{{title}}\n")
  await putCatalogFile(vault, "Memory.base", "views: []\n")

  const report = await reportVault(memory, memory.global, context)

  expect(report).toMatchObject({ blanks: [], unreadable: [], diagnosis: { blank: [], invalid: [] } })
})

test("each vault is reported under its own scope", async () => {
  const { context, project, memory, projectTarget } = await resolvedFixture()
  await putCatalogFile(project, "Deploy.md", noteWithId(3, "Deploy.", []))

  const report = await reportVault(memory, projectTarget, context)

  expect(report).toMatchObject({ vault: "project", diagnosis: { invalid: [] } })
})

test("a vault that cannot be listed gives its problems instead of a diagnosis", async () => {
  const { context, project, memory, projectTarget } = await resolvedFixture()
  await rm(project.path, { recursive: true })

  const report = await reportVault(memory, projectTarget, context)

  expect(report).toMatchObject({ vault: "project", problems: [expect.any(String)] })
})
