import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { archiveStoredNote, readNote, succeedStoredNote } from "#/services"
import { aConfig, linkFolder, useTempVault, vaultWithNoteToArchive, vaultWithQuestion } from "#test-helpers"

test("reports completed relocation with a warning when index maintenance is refused", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive("2026-10-06")
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "index.md"))
  const result = await archiveStoredNote(vault, "Memory", request, aConfig().limits)
  expect(result).toMatchObject({ succeeded: true, maintenanceProblems: ["index.md leads outside the vault"] })
  expect(await readNote(vault, "archive/pnpm", note.statement, aConfig().limits)).toMatchObject({ succeeded: true })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
})

test.runIf(process.platform === "win32")(
  "reports the archived copy and retains the original when the successor write fails",
  async () => {
    const { vault, request, file } = await vaultWithQuestion("2026-10-06")
    const folder = "a".repeat(256)
    const destination = join(vault, folder)
    const succession = { ...request, successor: { ...request.successor, folder } }

    const result = await succeedStoredNote(vault, "Memory", succession, aConfig().limits)
    expect(result).toMatchObject({
      succeeded: false,
      reason: "partial",
      cause: { reason: "not-found" },
      originalState: "present",
      written: [{ folder: "archive/search", note: { statement: request.previous.note.statement } }],
    })
    expect(await readFile(file, "utf8")).toBe(renderNote(request.previous.note))
    expect(await readNote(vault, "archive/search", request.previous.note.statement, aConfig().limits)).toMatchObject({
      succeeded: true,
    })
    await expect(readFile(join(destination, `${request.successor.note.statement}.md`))).rejects.toMatchObject({
      code: "ENOENT",
    })
  },
)
