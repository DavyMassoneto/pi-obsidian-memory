import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { createMemoryNote, updateStoredFile } from "#src/services"
import { aLimits, aNote, putNoteFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

test("appends the extension to a statement that already contains dots", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), statement: "Use Node 20.x" }

  expect(await createMemoryNote({ path: vault, limits }, "tools", note)).toMatchObject({ succeeded: true })
  expect(await readdir(join(vault, "tools"))).toEqual(["Use Node 20.x.md"])
})

test.each(["", "tools", "tools/pnpm"])("updates the stored file under folder %j from its path", async (folder) => {
  const vault = await useTempFolder()
  const note = aNote()
  const text = renderNote(note)
  await putNoteFile(vault, folder, note.statement, text)
  const path = [folder, `${note.statement}.md`].filter((part) => part.length > 0).join("/")
  const edited = { ...note, body: "Edited body." }

  expect(
    await updateStoredFile(
      { path: vault, limits },
      { path, note: edited, expectedHash: createHash("sha256").update(text).digest("hex") },
    ),
  ).toMatchObject({ succeeded: true })
  expect(await readFile(join(vault, path), "utf8")).toBe(renderNote(edited))
  expect(await readdir(join(vault, folder))).toContain(`${note.statement}.md`)
})
