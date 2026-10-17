import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { succeedMemory } from "#src/usecases"
import { noteWithId, READIED_PATH as path, putCatalogFile, readiedNote } from "#test-helpers"

const draft = {
  statement: "Use bun, never pnpm",
  type: "decision" as const,
  body: "Bun is the runner now.",
  dontForget: true,
}

test("when the successor's name is taken nothing is published", async () => {
  const { context, vault, file } = await readiedNote("Always pnpm.", [])
  await putCatalogFile(vault, "tools/Use bun, never pnpm.md", noteWithId(2, "Already here.", []))

  const result = await succeedMemory({ vault: "global", path, folder: "tools", draft }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "exists" })
  expect(await readFile(file, "utf8")).toContain("Always pnpm.")
  await expect(readFile(join(vault.path, "archive/tools/Use pnpm.md"))).rejects.toMatchObject({ code: "ENOENT" })
})

test("an invalid successor is refused before anything is written", async () => {
  const { context, vault } = await readiedNote("Always pnpm.", [])

  const result = await succeedMemory({ vault: "global", path, folder: "tools", draft: { ...draft, body: "" } }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(await readdir(join(vault.path, "tools"))).toContain("Use pnpm.md")
})

test("a note edited after the read is a conflict and stays as the user left it", async () => {
  const { context, vault, file } = await readiedNote("Always pnpm.", [])
  await putCatalogFile(vault, path, noteWithId(1, "The user edited this.", []))
  const edited = await readFile(file, "utf8")

  const result = await succeedMemory({ vault: "global", path, folder: "tools", draft }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe(edited)
})

test.runIf(process.platform === "win32")(
  "on Windows: when the successor cannot be written the result lists the archived copy and says the original is still there",
  async () => {
    const { context, vault, file } = await readiedNote("Always pnpm.", [])

    const result = await succeedMemory({ vault: "global", path, folder: "a".repeat(256), draft }, context)

    expect(result).toMatchObject({
      succeeded: false,
      reason: "partial",
      published: ["archive/tools/Use pnpm.md"],
      originalState: "present",
    })
    expect(await readFile(file, "utf8")).toContain("Always pnpm.")
    expect(await readFile(join(vault.path, "archive/tools/Use pnpm.md"), "utf8")).toContain("archived:")
  },
)
