import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { createMemoryNote } from "#src/services"
import { aLimits, aNote, tryLinkFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

test("refuses an occupied cross-folder file alias with its logical statement", async (context) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "sub"))
  const target = join(vault, "sub", "Target.md")
  await writeFile(target, "user content")
  const alias = join(vault, "Alias.md")
  if (!(await tryLinkFile(target, alias))) {
    context.skip("this system cannot create file links")
    return
  }

  expect(await createMemoryNote({ path: vault, limits }, "", { ...aNote(), statement: "Alias" })).toMatchObject({
    succeeded: false,
    reason: "exists",
    existingStatement: "Alias",
  })
  expect(await readFile(target, "utf8")).toBe("user content")
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
})

test("publishes only one of concurrent creates without replacing the winner", async () => {
  const vault = await useTempFolder()
  const attempts = Array.from({ length: 12 }, (_, index) => ({ ...aNote(), body: `Writer ${index}` }))
  const results = await Promise.all(attempts.map((note) => createMemoryNote({ path: vault, limits }, "", note)))
  const saved = results.filter((result) => result.succeeded)
  expect(saved).toHaveLength(1)
  const winner = saved[0]
  if (!winner?.succeeded) {
    throw new Error("missing winner")
  }

  expect(await readFile(join(vault, `${aNote().statement}.md`), "utf8")).toBe(renderNote(winner.output.note))
  expect(await readdir(vault)).toEqual([`${aNote().statement}.md`])
})

test.runIf(process.platform === "win32")(
  "reports the actual winning filename after case-insensitive concurrent creation",
  async () => {
    const vault = await useTempFolder()
    const attempts = ["Mixed case", "MIXED CASE", "mixed case"].map((statement) => ({ ...aNote(), statement }))
    const results = await Promise.all(attempts.map((note) => createMemoryNote({ path: vault, limits }, "", note)))
    const files = await readdir(vault)
    expect(files).toHaveLength(1)
    const expectedStatement = files[0]?.slice(0, -3)
    for (const result of results) {
      if (!result.succeeded) {
        expect(result).toMatchObject({ reason: "exists", existingStatement: expectedStatement })
      }
    }
  },
)
