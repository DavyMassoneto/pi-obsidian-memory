import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { succeedMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  noteWithId,
  READIED_PATH as path,
  putCatalogFile,
  readiedNote,
} from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

const draft = {
  statement: "Use bun, never pnpm",
  type: "decision" as const,
  body: "Bun is the runner now.",
  dontForget: true,
}

test("after a read the old note is archived, the successor is created and each links the other", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, vault, file } = await readiedNote("Always pnpm.", [])

  const result = await succeedMemory({ vault: "global", path, folder: "tools", draft }, context)

  expect(result).toMatchObject({
    succeeded: true,
    output: {
      vault: "global",
      path,
      archivedPath: "archive/tools/Use pnpm.md",
      successorPath: "tools/Use bun, never pnpm.md",
      maintenanceProblems: [],
    },
  })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  const archived = await readFile(join(vault.path, "archive/tools/Use pnpm.md"), "utf8")
  const successor = await readFile(join(vault.path, "tools/Use bun, never pnpm.md"), "utf8")
  expect(archived).toContain("archived: 2026-10-20")
  expect(archived).toContain('replacedBy: "[[tools/Use bun, never pnpm]]"')
  expect(successor).toContain('replaces: "[[archive/tools/Use pnpm]]"')
  expect(successor).toContain("created: 2026-10-20")
  expect(successor).toContain("dontForget: true")
  expect(successor).not.toContain("01JABCDE7XKQ2M9V3RTN8WPZ01")
  await expectRegistrationLeaseReleased(context)
})

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
