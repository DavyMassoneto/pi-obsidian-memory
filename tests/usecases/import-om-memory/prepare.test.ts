import { realpath } from "node:fs/promises"

import { expect, test } from "vitest"

import { prepareOmImport } from "#src/usecases"
import {
  aLongOmTopic,
  OM_IMPORT_CHUNK_TOKENS,
  OM_LAYOUT_FILES,
  omImportFixture,
  writeProjectFiles,
} from "#test-helpers"

test("a folder with no project vault is refused and asks for /memory-init", async () => {
  const { context, unregisteredFolder } = await omImportFixture()

  const prepared = await prepareOmImport({ ...context, workingFolder: unregisteredFolder })

  expect(prepared).toMatchObject({
    succeeded: false,
    reason: "no-project",
    workingFolder: await realpath(unregisteredFolder),
  })
  if (prepared.succeeded) throw new Error("expected a refusal")
  expect(prepared.problems.join("\n")).toContain("/memory-init")
})

test("a project with no .memory folder plans no files", async () => {
  const { context, projectFolder } = await omImportFixture()

  const prepared = await prepareOmImport(context)

  expect(prepared).toMatchObject({ succeeded: true, output: { folder: await realpath(projectFolder), files: [] } })
})

test("the files OM wrote are planned as parts, at most the observer chunk size each", async () => {
  const { context, projectFolder } = await omImportFixture()
  await writeProjectFiles(projectFolder, [...OM_LAYOUT_FILES, aLongOmTopic(".memory/long.md")])

  const prepared = await prepareOmImport(context)

  if (!prepared.succeeded) throw new Error(prepared.problems.join("\n"))
  const { files } = prepared.output
  expect(files.map((file) => file.path)).toEqual([
    ".memory/2026-abc/JOURNEY.md",
    ".memory/2026-abc/topic.md",
    ".memory/aaa-session/JOURNEY.md",
    ".memory/beamer-kvm.md",
    ".memory/long.md",
  ])
  const long = files.find((file) => file.path === ".memory/long.md")
  expect(long?.parts.length).toBeGreaterThan(2)
  for (const file of files) {
    for (const part of file.parts) expect(part.length).toBeLessThanOrEqual(OM_IMPORT_CHUNK_TOKENS * 4)
  }
  expect(files.find((file) => file.path === ".memory/beamer-kvm.md")?.parts).toEqual([
    "---\nname: beamer\n---\nflat topic\n",
  ])
})
