import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { archiveMemory } from "#src/usecases"
import {
  changeFixture,
  noteWithId,
  READIED_PATH as path,
  putCatalogFile,
  readiedNote,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("a note whose body is over a lowered limit can still be archived", async () => {
  const { context, vault, config, read } = await changeFixture()
  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, limits: { ...config.limits, maxBodyChars: 10 } }),
  )
  await putCatalogFile(vault, path, noteWithId(1, "A body that is much longer than the lowered limit.", []))
  expect((await read("global", path)).succeeded).toBe(true)

  const result = await archiveMemory({ vault: "global", path }, context)

  expect(result).toMatchObject({ succeeded: true, output: { archivedPath: "archive/tools/Use pnpm.md" } })
  expect(await readFile(join(vault.path, "archive/tools/Use pnpm.md"), "utf8")).toContain("much longer")
})

test("a note edited after the read is a conflict and stays as the user left it", async () => {
  const { context, vault, file } = await readiedNote("Always pnpm.", [])
  await putCatalogFile(vault, path, noteWithId(1, "The user edited this.", []))
  const edited = await readFile(file, "utf8")

  const result = await archiveMemory({ vault: "global", path }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe(edited)
})

test("when the archived copy's name is taken nothing is published", async () => {
  const { context, vault, file } = await readiedNote("Always pnpm.", [])
  await putCatalogFile(vault, "archive/tools/Use pnpm.md", noteWithId(9, "Older copy.", ["archived: 2026-01-01"]))

  const refused = await archiveMemory({ vault: "global", path }, context)

  expect(refused).toMatchObject({ succeeded: false, reason: "exists" })
  expect(await readFile(file, "utf8")).toContain("Always pnpm.")
  expect(await readFile(join(vault.path, "archive/tools/Use pnpm.md"), "utf8")).toContain("Older copy.")
})
