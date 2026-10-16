import { mkdir, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { createMemoryNote } from "#src/services"
import { aLimits, aNote, putNoteFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

test.each([
  ["", "Rule.md", "Rule.md already exists"],
  ["tools/pnpm", "RULE.md", "tools/pnpm/RULE.md already exists"],
])("refuses to create over %s/%s, naming the statement as it is on disk", async (folder, existing, message) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, folder), { recursive: true })
  await putNoteFile(vault, folder, existing.slice(0, -3), "user note")

  expect(await createMemoryNote({ path: vault, limits }, folder, { ...aNote(), statement: "Rule" })).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: existing.slice(0, -3),
    problems: [message],
  })
  expect(await readFile(join(vault, folder, existing), "utf8")).toBe("user note")
  expect(await readdir(join(vault, folder))).toEqual([existing])
})

test.runIf(process.platform === "win32")(
  "reports the failed write with the note path and the system code",
  async () => {
    const vault = await useTempFolder()
    const folder = "a".repeat(256)

    expect(await createMemoryNote({ path: vault, limits }, folder, aNote())).toEqual({
      succeeded: false,
      reason: "not-found",
      problems: [`${folder}/${aNote().statement}.md cannot be written (ENOENT)`],
    })
    expect(await readdir(vault)).toEqual([])
  },
)
