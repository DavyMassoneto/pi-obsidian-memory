import { createHash } from "node:crypto"
import { lstat, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { readNote, refreshIndexes, updateNote } from "#/services"
import { aLimits, linkFolder, readIndexOf, tryLinkFile, useTempFolder, vaultWithNote } from "#test-helpers"

const limits = aLimits()

test("updates an internal file alias target and preserves the alias", async (context) => {
  const { vault, note, file, hash } = await vaultWithNote()
  const alias = join(vault, "pnpm", "Alias.md")
  if (!(await tryLinkFile(file, alias))) {
    context.skip("this system cannot create file links")
    return
  }
  const changed = { ...note, statement: "Alias", body: "Updated target" }

  expect(await updateNote({ path: vault, limits }, "pnpm", changed, hash)).toMatchObject({ succeeded: true })
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
})

test("refreshes an updated directory alias using the physical index location", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  await linkFolder(join(vault, "pnpm"), join(vault, "alias"))
  const changed = { ...note, frontmatter: { ...note.frontmatter, dontForget: true as const } }

  expect(await updateNote({ path: vault, limits }, "alias", changed, hash)).toMatchObject({ succeeded: true })
  expect(await refreshIndexes({ path: vault, name: "Memory", limits }, "alias")).toEqual({ succeeded: true })
  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(await readIndexOf(vault, "pnpm")).toContain(`[[pnpm/${note.statement}|${note.statement}]]`)
  expect(await readIndexOf(vault, "pnpm")).toContain("· don't forget")
  expect(await readIndexOf(vault, "")).toContain("[[alias/index|alias]]")
  expect(await readIndexOf(vault, "")).toContain("[[pnpm/index|pnpm]]")
})

test("writes the new content when the file did not change since it was read", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const changed = { ...note, body: "Use pnpm for every install, script and CI job." }

  const updated = await updateNote({ path: vault, limits }, "pnpm", changed, hash)

  expect(await readFile(file, "utf8")).toBe(renderNote(changed))
  expect(updated).toEqual(await readNote({ path: vault, limits }, "pnpm", note.statement))
})

test("refuses with a conflict when the file changed on disk, keeping that change", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const editedInObsidian = renderNote({ ...note, body: "Edited by the user." })
  await writeFile(file, editedInObsidian)

  expect(await updateNote({ path: vault, limits }, "pnpm", { ...note, body: "Agent change." }, hash)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readFile(file, "utf8")).toBe(editedInObsidian)
})

test("refuses with a conflict when the file was deleted since it was read", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  await rm(file)

  expect(await updateNote({ path: vault, limits }, "pnpm", note, hash)).toEqual({
    succeeded: false,
    reason: "conflict",
    problems: [`pnpm/${note.statement}.md changed on disk since it was read`],
  })
  expect(await readdir(join(vault, "pnpm"))).toEqual([])
})

test("refuses an invalid note and leaves the file untouched", async () => {
  const { vault, note, file, hash } = await vaultWithNote()
  const before = await readFile(file, "utf8")

  expect(await updateNote({ path: vault, limits }, "pnpm", { ...note, body: "" }, hash)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readFile(file, "utf8")).toBe(before)
})

test("refuses to write through a file link that leads outside the vault, leaving the target unchanged", async (context) => {
  const { vault, note } = await vaultWithNote()
  const outside = await useTempFolder()
  const secret = join(outside, "Secret.md")
  const original = renderNote(note)
  await writeFile(secret, original)
  const linked = await tryLinkFile(secret, join(vault, "pnpm", "Linked.md"))
  if (!linked) {
    context.skip("this system cannot create file links")
  }

  const hash = createHash("sha256").update(original).digest("hex")

  expect(
    await updateNote({ path: vault, limits }, "pnpm", { ...note, statement: "Linked", body: "Changed." }, hash),
  ).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["pnpm/Linked.md leads outside the vault"],
  })
  expect(await readFile(secret, "utf8")).toBe(original)
})
