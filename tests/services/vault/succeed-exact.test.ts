import { lstat, readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { succeedStoredFile } from "#src/services"
import {
  aDecision,
  holdFileWithoutDeleteSharing,
  putCatalogFile,
  tryLinkFile,
  vaultWithStoredFile,
} from "#test-helpers"

const today = "2026-10-06"

test.each([".MD", ".mD"])("succeeds the exact %s original and retains reciprocal links", async (extension) => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(extension)
  const successor = { folder, note: aDecision() }
  expect(
    await succeedStoredFile(vault, { path, previous: { folder, note }, hashWhenRead: hash, successor, today }),
  ).toMatchObject({
    succeeded: true,
    output: {
      archived: {
        note: { frontmatter: { id: note.frontmatter.id, replacedBy: `[[${folder}/${successor.note.statement}]]` } },
      },
      successor: {
        note: { frontmatter: { created: today, updated: today, replaces: `[[archive/${folder}/${note.statement}]]` } },
      },
    },
  })
  await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" })
  expect((await readdir(join(vault.path, folder))).sort()).toEqual([`${successor.note.statement}.md`, "index.md"])
  expect((await readdir(join(vault.path, "archive", folder))).sort()).toEqual([`${note.statement}.md`, "index.md"])
  expect(await readFile(join(vault.path, folder, `${successor.note.statement}.md`), "utf8")).toContain(
    `[[archive/${folder}/${note.statement}]]`,
  )
  expect(await readFile(join(vault.path, "archive", folder, `${note.statement}.md`), "utf8")).toContain(
    `[[${folder}/${successor.note.statement}]]`,
  )
})

test("exact succession preflight detects changed bytes and publishes nothing", async () => {
  const { vault, note, folder, path, file, hash } = await vaultWithStoredFile(".mD")
  await putCatalogFile(vault, path, "User edit")
  expect(
    await succeedStoredFile(vault, {
      path,
      previous: { folder, note },
      hashWhenRead: hash,
      successor: { folder, note: aDecision() },
      today,
    }),
  ).toMatchObject({ reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe("User edit")
  expect(await readdir(vault.path)).toEqual([folder])
})

test("exact succession refuses mismatched original folders and invalid or occupied successors", async () => {
  const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".MD")
  const request = {
    path,
    previous: { folder, note },
    hashWhenRead: hash,
    successor: { folder, note: aDecision() },
    today,
  }
  expect(await succeedStoredFile(vault, { ...request, previous: { folder: "Other", note } })).toMatchObject({
    reason: "invalid",
  })
  expect(
    await succeedStoredFile(vault, { ...request, successor: { folder: "archive", note: aDecision() } }),
  ).toMatchObject({ reason: "invalid" })
  expect(await readdir(vault.path)).toEqual([folder])
  await putCatalogFile(vault, `${folder}/${request.successor.note.statement}.MD`, "Occupied")
  expect(await succeedStoredFile(vault, request)).toMatchObject({ reason: "exists" })
  expect(await readdir(vault.path)).toEqual([folder])
  expect(await readFile(file, "utf8")).toBe(text)
  expect(await readFile(join(vault.path, folder, `${request.successor.note.statement}.MD`), "utf8")).toBe("Occupied")
})

test("exact succession rejects differently named canonical originals before publishing", async (context) => {
  const { vault, note, folder, file, hash, text } = await vaultWithStoredFile(".MD")
  const path = "Other.MD"
  const alias = join(vault.path, path)
  if (!(await tryLinkFile(file, alias))) return context.skip("this system cannot create file links")
  expect(
    await succeedStoredFile(vault, {
      path,
      previous: { folder: "", note: { ...note, statement: "Other" } },
      hashWhenRead: hash,
      successor: { folder, note: aDecision() },
      today,
    }),
  ).toMatchObject({ reason: "invalid" })
  expect(await readFile(file, "utf8")).toBe(text)
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
  expect((await readdir(vault.path)).sort()).toEqual([path, folder].sort())
})

test.runIf(process.platform === "win32")(
  "exact succession retains both publications in order when original removal is denied",
  async () => {
    const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".mD")
    const successor = { folder, note: aDecision() }
    const release = await holdFileWithoutDeleteSharing(file)
    try {
      expect(
        await succeedStoredFile(vault, { path, previous: { folder, note }, hashWhenRead: hash, successor, today }),
      ).toMatchObject({
        reason: "partial",
        cause: { reason: "not-writable" },
        originalState: "present",
        written: [
          { folder: `archive/${folder}`, note: { statement: note.statement } },
          { folder, note: { statement: successor.note.statement } },
        ],
      })
      expect(await readFile(file, "utf8")).toBe(text)
      expect((await readdir(join(vault.path, folder))).sort()).toEqual(
        [`${note.statement}.mD`, `${successor.note.statement}.md`].sort(),
      )
      expect(await readFile(join(vault.path, "archive", folder, `${note.statement}.md`), "utf8")).toContain(
        `[[${folder}/${successor.note.statement}]]`,
      )
      expect(await readFile(join(vault.path, folder, `${successor.note.statement}.md`), "utf8")).toContain(
        `[[archive/${folder}/${note.statement}]]`,
      )
    } finally {
      await release()
    }
  },
  15000,
)

test.runIf(process.platform === "win32")(
  "exact succession observes the mixed-case original after a late failure",
  async () => {
    const { vault, note, folder, path, file, hash, text } = await vaultWithStoredFile(".mD")
    expect(
      await succeedStoredFile(vault, {
        path,
        previous: { folder, note },
        hashWhenRead: hash,
        successor: { folder: "a".repeat(256), note: aDecision() },
        today,
      }),
    ).toMatchObject({
      reason: "partial",
      originalState: "present",
      written: [{ folder: `archive/${folder}`, note: { statement: note.statement } }],
    })
    expect(await readFile(file, "utf8")).toBe(text)
    expect(await readdir(join(vault.path, folder))).toEqual([`${note.statement}.mD`])
    expect(await readdir(join(vault.path, "archive", folder))).toEqual([`${note.statement}.md`])
  },
)
