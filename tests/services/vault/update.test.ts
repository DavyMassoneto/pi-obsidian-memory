import { chmod, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain/note"
import { createNote, readNote, updateNote } from "#/services/vault"
import { aNote, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

async function vaultWithNote() {
  const vault = await useTempVault()
  const note = aNote()
  const created = await createNote(vault, "pnpm", note, limits)
  if (!created.succeeded) {
    throw new Error(`setup failed: ${created.problems.join(", ")}`)
  }
  return { vault, note, file: join(vault, "pnpm", `${note.statement}.md`), hash: created.output.hash }
}

test("writes the new content when the file did not change since it was read", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const changed = { ...note, body: "Use pnpm for every install, script and CI job." }

  const updated = await updateNote(vault, "pnpm", changed, hash, limits)

  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(updated).toEqual(await readNote(vault, "pnpm", note.statement))
})

test("refuses with a conflict when the file changed on disk, keeping that change", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const editedInObsidian = renderNote({ ...note, body: "Edited by the user." })
  await writeFile(file, editedInObsidian)

  expect(await updateNote(vault, "pnpm", { ...note, body: "Agent change." }, hash, limits)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readFile(file, "utf8")).toBe(editedInObsidian)
})

test("refuses with a conflict when the file was deleted since it was read", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  await rm(file)

  expect(await updateNote(vault, "pnpm", note, hash, limits)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readdir(join(vault, "pnpm"))).toEqual([])
})

test("refuses an invalid note and leaves the file untouched", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const before = await readFile(file, "utf8")

  expect(await updateNote(vault, "pnpm", { ...note, body: "" }, hash, limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readFile(file, "utf8")).toBe(before)
})

test.runIf(process.platform === "win32")(
  "refuses a read-only note, keeping it and leaving no temporary file",
  async () => {
    const { vault, note, file, hash } = await vaultWithNote()
    const before = await readFile(file, "utf8")
    await chmod(file, 0o444)

    try {
      expect(await updateNote(vault, "pnpm", { ...note, body: "New body." }, hash, limits)).toEqual({
        succeeded: false,
        reason: "not-writable",
        problems: [`pnpm/${note.statement}.md cannot be written (EPERM)`],
      })
      expect(await readFile(file, "utf8")).toBe(before)
      expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
    } finally {
      await chmod(file, 0o666)
    }
  },
)

test("leaves no temporary file behind", async () => {
  const { vault, note, hash } = await vaultWithNote()

  await updateNote(vault, "pnpm", { ...note, body: "New body." }, hash, limits)

  expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
})
