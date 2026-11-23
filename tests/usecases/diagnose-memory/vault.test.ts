import { rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { reportVault } from "#src/usecases"
import { noteWithId, putBrokenVault, putCatalogFile, resolvedFixture } from "#test-helpers"

test("a vault with a broken note, a copied note, a blank note and a leftover temporary file gets one report", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putBrokenVault(vault)

  const report = await reportVault(memory.global, context)

  expect(report).toMatchObject({
    vault: "global",
    diagnosis: {
      invalid: [{ path: "tools/Broken.md", problems: [expect.stringContaining("colour")] }],
      blank: ["Blank.md"],
      duplicateIds: [{ paths: ["copies/Copy one.md", "copies/Copy two.md"] }],
      temporaries: ["tools/Half.md.tmp-abc"],
    },
    blanks: [{ path: "Blank.md", empty: true, rawHash: expect.any(String) }],
    unreadable: [],
  })
})

test("many valid notes in one folder are not diagnosed as a problem", async () => {
  const { context, vault, memory } = await resolvedFixture()
  for (let number = 0; number < 21; number++) {
    await putCatalogFile(vault, `tools/Note ${number}.md`, noteWithId(100 + number, `Note ${number}.`, []))
  }

  const report = await reportVault(memory.global, context)
  if ("problems" in report) throw new Error("vault diagnosis failed")
  expect(report.diagnosis).toEqual({ invalid: [], blank: [], duplicateIds: [], temporaries: [] })
  expect(report.unreadable).toEqual([])
})

test("a blank file with text is reported as blank but not empty", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putCatalogFile(vault, "Typed.md", "Some text with no frontmatter")

  const report = await reportVault(memory.global, context)

  expect(report).toMatchObject({ blanks: [{ path: "Typed.md", empty: false }] })
})

test("folder indexes, templates and the dashboard are not mistaken for blank notes or unreadable files", async () => {
  const { context, vault, memory } = await resolvedFixture()
  await putCatalogFile(vault, "index.md", "# Global memory\n")
  await putCatalogFile(vault, "_templates/rule.md", "{{title}}\n")
  await putCatalogFile(vault, "Memory.base", "views: []\n")

  const report = await reportVault(memory.global, context)

  expect(report).toMatchObject({ blanks: [], unreadable: [], diagnosis: { blank: [], invalid: [] } })
})

test("each vault is reported under its own scope", async () => {
  const { context, project, projectTarget } = await resolvedFixture()
  await putCatalogFile(project, "Deploy.md", noteWithId(3, "Deploy.", []))

  const report = await reportVault(projectTarget, context)

  expect(report).toMatchObject({ vault: "project", diagnosis: { invalid: [] } })
})

test("a vault that cannot be listed gives its problems instead of a diagnosis", async () => {
  const { context, project, projectTarget } = await resolvedFixture()
  await rm(project.path, { recursive: true })

  const report = await reportVault(projectTarget, context)

  expect(report).toMatchObject({ vault: "project", problems: [expect.any(String)] })
})
