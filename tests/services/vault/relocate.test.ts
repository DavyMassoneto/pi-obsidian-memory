import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { archiveStoredNote, readNote, succeedStoredNote } from "#src/services"
import { aLimits, linkFolder, useTempFolder, vaultWithNoteToArchive, vaultWithQuestion } from "#test-helpers"

test("reports completed relocation with a warning when index maintenance is refused", async () => {
  const { vault, note, request, file } = await vaultWithNoteToArchive("2026-10-06")
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "index.md"))
  const result = await archiveStoredNote({ path: vault, name: "Memory", limits: aLimits() }, request)
  expect(result).toMatchObject({ succeeded: true, maintenanceProblems: ["index.md leads outside the vault"] })
  expect(await readNote({ path: vault, limits: aLimits() }, "archive/pnpm", note.statement)).toMatchObject({
    succeeded: true,
  })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
})

test.runIf(process.platform === "win32")(
  "reports the archived copy and retains the original when the successor write fails",
  async () => {
    const { vault, request, file } = await vaultWithQuestion("2026-10-06")
    const folder = "a".repeat(256)
    const destination = join(vault, folder)
    const succession = { ...request, successor: { ...request.successor, folder } }

    const result = await succeedStoredNote({ path: vault, name: "Memory", limits: aLimits() }, succession)
    expect(result).toMatchObject({
      succeeded: false,
      reason: "partial",
      cause: { reason: "not-found" },
      originalState: "present",
      written: [{ folder: "archive/search", note: { statement: request.previous.note.statement } }],
    })
    expect(await readFile(file, "utf8")).toBe(renderNote(request.previous.note))
    expect(
      await readNote({ path: vault, limits: aLimits() }, "archive/search", request.previous.note.statement),
    ).toMatchObject({
      succeeded: true,
    })
    await expect(readFile(join(destination, `${request.successor.note.statement}.md`))).rejects.toMatchObject({
      code: "ENOENT",
    })
  },
)
