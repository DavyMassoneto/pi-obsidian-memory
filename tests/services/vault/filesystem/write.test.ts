import { chmod, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { updateNote } from "#src/services"
import { aLimits, vaultWithNote } from "#test-helpers"

const limits = aLimits()

test.runIf(process.platform === "win32")(
  "refuses a read-only note, keeping it and leaving no temporary file",
  async () => {
    const { vault, note, file, hash } = await vaultWithNote()
    const before = await readFile(file, "utf8")
    await chmod(file, 0o444)

    try {
      expect(await updateNote({ path: vault, limits }, "pnpm", { ...note, body: "New body." }, hash)).toEqual({
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

  await updateNote({ path: vault, limits }, "pnpm", { ...note, body: "New body." }, hash)

  expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
})
