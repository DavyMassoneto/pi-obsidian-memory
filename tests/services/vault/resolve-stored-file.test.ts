import { lstat, readdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { archiveStoredFile, succeedStoredFile, updateStoredFile } from "#/services"
import { aDecision, catalogVault, linkFolder, putCatalogFile, tryLinkFile, vaultWithStoredFile } from "#test-helpers"

test("exact resolution refuses non-Markdown originals before lifecycle publication", async () => {
  const { vault, note, folder, hash, text } = await vaultWithStoredFile(".txt")
  const path = `${folder}/${note.statement}.txt`
  expect(
    await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today: "2026-10-06" }),
  ).toMatchObject({ reason: "invalid" })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
  expect(await readdir(vault.path)).toEqual([folder])
})

test("exact lifecycle does not use diagnostic readability to write invalid names", async () => {
  const { vault, note, hash, text } = await vaultWithStoredFile(".MD")
  const path = "[bad].MD"
  await putCatalogFile(vault, path, text)
  const previous = { folder: "", note: { ...note, statement: "[bad]" } }
  expect(
    await archiveStoredFile(vault, { path, note: previous, hashWhenRead: hash, today: "2026-10-06" }),
  ).toMatchObject({ reason: "invalid" })
  expect(
    await succeedStoredFile(vault, {
      path,
      previous,
      hashWhenRead: hash,
      successor: { folder: "", note: aDecision() },
      today: "2026-10-06",
    }),
  ).toMatchObject({ reason: "invalid" })
  expect(await readFile(join(vault.path, path), "utf8")).toBe(text)
  expect((await readdir(vault.path)).sort()).toEqual(["Subject", path].sort())
})

test("exact original resolution refuses escaping directory aliases without touching either vault", async () => {
  const { vault: outside, note, folder, hash, text, file } = await vaultWithStoredFile(".mD")
  const vault = { ...(await catalogVault()), name: "Memory" }
  await linkFolder(join(outside.path, folder), join(vault.path, folder))
  const path = `${folder}/${note.statement}.mD`
  expect(await updateStoredFile(vault, { path, note, expectedHash: hash })).toMatchObject({ reason: "outside-vault" })
  expect(
    await archiveStoredFile(vault, { path, note: { folder, note }, hashWhenRead: hash, today: "2026-10-06" }),
  ).toMatchObject({ reason: "outside-vault" })
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readdir(vault.path)).toEqual([folder])
  expect(await readdir(outside.path)).toEqual([folder])
})

test("exact resolution detects an alias retargeted to changed bytes", async (context) => {
  const { vault, note, file, hash, text } = await vaultWithStoredFile(".mD")
  const path = `${note.statement}.MD`
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  const replacement = `Replacement/${note.statement}.mD`
  await putCatalogFile(vault, replacement, "Retargeted content")
  await rm(alias)
  if (!(await tryLinkFile(join(vault.path, replacement), alias))) throw new Error("Could not retarget test link")
  expect(
    await archiveStoredFile(vault, { path, note: { folder: "", note }, hashWhenRead: hash, today: "2026-10-06" }),
  ).toMatchObject({ reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readFile(alias, "utf8")).toBe("Retargeted content")
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect((await readdir(vault.path)).sort()).toEqual([path, "Replacement", "Subject"].sort())
})

test.runIf(process.platform === "win32")(
  "exact resolution preserves actual extension spelling and rejects case-only statement changes",
  async () => {
    const { vault, note, folder, file, hash, text } = await vaultWithStoredFile(".mD")
    const lower = note.statement.toLowerCase()
    expect(
      await updateStoredFile(vault, {
        path: `${folder}/${lower}.mD`,
        note: { ...note, statement: lower },
        expectedHash: hash,
      }),
    ).toMatchObject({ reason: "invalid" })
    expect(await readFile(file, "utf8")).toBe(text)
    const changed = { ...note, body: "New body, same physical spelling." }
    expect(
      await updateStoredFile(vault, { path: `${folder}/${note.statement}.md`, note: changed, expectedHash: hash }),
    ).toMatchObject({ succeeded: true })
    expect(await readFile(file, "utf8")).toBe(renderNote(changed))
    expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}.mD`])
  },
)
