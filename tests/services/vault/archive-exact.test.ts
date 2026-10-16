import { lstat, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { archiveStoredFile, refreshIndexes } from "#src/services"
import {
  holdFileWithoutDeleteSharing,
  linkFolder,
  putCatalogFile,
  readIndexOf,
  tryLinkFile,
  vaultWithStoredFile,
} from "#test-helpers"

const today = "2026-10-06"

test.each([".MD", ".mD"])("archives and removes the exact %s original", async (extension) => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(extension)
  expect(await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today })).toMatchObject({
    succeeded: true,
    output: { folder: `archive/${folder}`, note: { frontmatter: { ...note.frontmatter, archived: today } } },
  })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(join(vault.path, folder))).toEqual(["index.md"])
  expect((await readdir(join(vault.path, "archive", folder))).sort()).toEqual([`${note.statement}.md`, "index.md"])
  expect(await readFile(join(vault.path, "archive", folder, `${note.statement}.md`), "utf8")).toBe(
    renderNote({ ...note, frontmatter: { ...note.frontmatter, archived: today } }),
  )
})

test("exact archive preflight preserves changed bytes and publishes nothing", async () => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(".mD")
  await putCatalogFile(vault, path, "Obsidian edit")
  expect(await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today })).toMatchObject({
    reason: "conflict",
  })
  expect(await readFile(file, "utf8")).toBe("Obsidian edit")
  expect(await readdir(vault.path)).toEqual([folder])
})

test("exact archive refuses folder and statement mismatches before any publication", async () => {
  const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".MD")
  for (const placed of [
    { folder: "Other", note },
    { folder, note: { ...note, statement: "Other" } },
  ]) {
    expect(await archiveStoredFile(vault, { path, note: placed, hashWhenRead: hash, today })).toMatchObject({
      reason: "invalid",
    })
  }
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readdir(vault.path)).toEqual([folder])
})

test("exact archive preserves occupied archive destinations and originals", async () => {
  const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".mD")
  const occupied = `archive/${folder}/${note.statement}.MD`
  await putCatalogFile(vault, occupied, "Existing archive")
  expect(await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today })).toMatchObject({
    reason: "exists",
  })
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readFile(join(vault.path, occupied), "utf8")).toBe("Existing archive")
  expect(await readdir(join(vault.path, "archive", folder))).toEqual([`${note.statement}.MD`])
})

test("exact archive follows directory aliases and refreshes physical and logical ancestors", async () => {
  const { vault, note, folder, file, hash } = await vaultWithStoredFile(".mD")
  await linkFolder(join(vault.path, folder), join(vault.path, "Alias"))
  await refreshIndexes(vault, folder)
  expect(
    await archiveStoredFile(vault, {
      path: `Alias/${note.statement}.mD`,
      note: { folder: "Alias", note },
      hashWhenRead: hash,
      today,
    }),
  ).toMatchObject({ succeeded: true })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readIndexOf(vault.path, folder)).not.toContain(note.statement)
  expect(await readIndexOf(vault.path, "archive/Alias")).toContain(note.statement)
  expect(await readIndexOf(vault.path, "")).toContain(`[[${folder}/index|${folder}]]`)
})

test("exact archive removes a same-name alias target and refreshes its physical parent", async (context) => {
  const { vault, note, folder, file, hash } = await vaultWithStoredFile(".mD")
  const path = `${note.statement}.MD`
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  await refreshIndexes(vault, folder)
  expect(await archiveStoredFile(vault, { path, note: { folder: "", note }, hashWhenRead: hash, today })).toMatchObject(
    {
      succeeded: true,
    },
  )
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(join(vault.path, folder))).toEqual(["index.md"])
  expect(await readIndexOf(vault.path, folder)).not.toContain(note.statement)
  expect(await readIndexOf(vault.path, "")).toContain("Needs fixing")
})

test("exact archive rejects a differently named file target with no published copy", async (context) => {
  const { vault, note, folder, file, hash, text } = await vaultWithStoredFile(".MD")
  const path = "Other.MD"
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  expect(
    await archiveStoredFile(vault, {
      path,
      note: { folder: "", note: { ...note, statement: "Other" } },
      hashWhenRead: hash,
      today,
    }),
  ).toMatchObject({ reason: "invalid" })
  expect(await readFile(file, "utf8")).toBe(text)
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect((await readdir(vault.path)).sort()).toEqual([path, folder].sort())
})

test.runIf(process.platform === "win32")(
  "exact archive reports the retained original when removal is denied",
  async () => {
    const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".mD")
    const release = await holdFileWithoutDeleteSharing(file)
    try {
      expect(await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today })).toMatchObject(
        {
          reason: "partial",
          cause: { reason: "not-writable" },
          originalState: "present",
          written: [{ folder: `archive/${folder}`, note: { statement: note.statement } }],
        },
      )
      expect(await readFile(file, "utf8")).toBe(text)
      expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}.mD`])
      expect(await readFile(join(vault.path, "archive", folder, `${note.statement}.md`), "utf8")).toContain(today)
    } finally {
      await release()
    }
  },
  15000,
)
