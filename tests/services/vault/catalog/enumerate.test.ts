import { link, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { enumerateVault, inspectVaultFile } from "#/services"
import { catalogVault, linkFolder, noteText, putCatalogFile, useTempVault, validFrontmatterLines } from "#test-helpers"

test("enumerates subjects iteratively, includes archive and temporaries, and records direct folder coverage", async () => {
  const vault = await catalogVault()
  const deep = Array.from({ length: 40 }, () => "d").join("/")
  for (const path of [
    "a.md",
    "index.md",
    "archive/old.md",
    "_templates/rule.md",
    "topic/_templates/a.md",
    "topic/archive/b.md",
    ".obsidian/private.md",
    ".draft.md.tmp-123",
    "image.png",
    "Memory.base",
    `${deep}/deep.md`,
  ]) {
    await putCatalogFile(vault, path, "content")
  }
  const result = await enumerateVault(vault)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) return
  expect(result.output.entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "a.md", kind: "note", archived: false }),
      expect.objectContaining({ path: "archive/old.md", kind: "note", archived: true }),
      expect.objectContaining({ path: "topic/archive/b.md", kind: "note", archived: false }),
      expect.objectContaining({ path: "topic/_templates/a.md", kind: "note" }),
      expect.objectContaining({ path: ".draft.md.tmp-123", kind: "temporary" }),
      expect.objectContaining({ path: "Memory.base", kind: "dashboard" }),
      expect.objectContaining({ path: `${deep}/deep.md`, kind: "note" }),
    ]),
  )
  expect(result.output.entries.map((entry) => entry.path)).not.toContain("_templates/rule.md")
  expect(result.output.observedPaths).not.toContain(".obsidian")
  expect(result.output.completeDirectories).toContain("")
  expect(result.output.completeDirectories).not.toContain("_templates")
  expect(result.output.failures).toEqual([])
  expect(await readFile(join(vault.path, "a.md"), "utf8")).toBe("content")
}, 15_000)

test("allows internal aliases without duplicate traversal, reports cycles/escapes/broken links, retains actual duplicate files", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "subject/a.md", "same")
  await link(join(vault.path, "subject/a.md"), join(vault.path, "subject/copy.md"))
  await linkFolder(join(vault.path, "subject"), join(vault.path, "alias"))
  await linkFolder(vault.path, join(vault.path, "subject/loop"))
  await linkFolder(await useTempVault(), join(vault.path, "outside"))
  await linkFolder(join(vault.path, "absent"), join(vault.path, "broken"))
  const result = await enumerateVault(vault)
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) return
  expect(result.output.entries.filter((entry) => entry.kind === "note").map((entry) => entry.path)).toEqual([
    "subject/a.md",
    "subject/copy.md",
  ])
  expect(result.output.aliases).toContainEqual({ path: "alias", target: "subject" })
  expect(result.output.failures).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "subject/loop", reason: "cycle", scope: "directory" }),
      expect.objectContaining({ path: "outside", reason: "outside-vault" }),
      expect.objectContaining({ path: "broken", reason: "not-found" }),
    ]),
  )
  expect(result.output.observedPaths).toEqual(expect.arrayContaining(["outside", "broken", "subject/loop"]))
  expect(result.output.completeDirectories).not.toContain("outside")
})

test("copied ULIDs remain separate path-keyed records including archive", async () => {
  const vault = await catalogVault()
  const text = noteText(validFrontmatterLines(), "same identity")
  for (const path of ["a.md", "copy.md", "archive/a.md"]) await putCatalogFile(vault, path, text)
  const scan = await enumerateVault(vault)
  if (!scan.succeeded) throw new Error("Expected enumeration")
  const notes = scan.output.entries.filter((entry) => entry.kind === "note")
  expect(notes.map((entry) => entry.path).sort()).toEqual(["a.md", "archive/a.md", "copy.md"])
  for (const entry of notes) {
    expect(await inspectVaultFile(vault, { path: entry.path })).toMatchObject({
      succeeded: true,
      output: { analysis: { frontmatter: { id: "01JABCDE7XKQ2M9V3RTN8WPZ5F" } } },
    })
  }
})

test("dashboard publication leftovers are diagnostics while ordinary hidden files and directories stay excluded", async () => {
  const vault = await catalogVault()
  const temporary = ".Memory.base.tmp-stale"
  const hidden = [".secret", ".Other.base.tmp-stale", ".Memory.base.tmp-", ".obsidian", ".Memory.base.tmp-directory"]
  await putCatalogFile(vault, temporary, "unpublished dashboard")
  for (const path of hidden.slice(0, 3)) await putCatalogFile(vault, path, "hidden")
  await putCatalogFile(vault, ".obsidian/.Memory.base.tmp-stale", "hidden")
  await putCatalogFile(vault, ".Memory.base.tmp-directory/note.md", "hidden")
  const result = await enumerateVault(vault)
  if (!result.succeeded) throw new Error("Expected enumeration")
  expect(result.output.entries.map(({ path, kind }) => ({ path, kind }))).toEqual([
    { path: temporary, kind: "temporary" },
  ])
  expect(result.output.observedPaths).toEqual([temporary])
  expect(result.output.completeDirectories).toEqual([""])
  expect(result.output.failures).toEqual([])
  for (const path of hidden) expect(result.output.observedPaths).not.toContain(path)
  expect(await readFile(join(vault.path, temporary), "utf8")).toBe("unpublished dashboard")
})

test("missing roots are refused without creation", async () => {
  const vault = await catalogVault()
  const missing = { ...vault, path: join(vault.path, "missing") }
  expect(await enumerateVault(missing)).toMatchObject({ succeeded: false, reason: "not-found", path: "" })
  await mkdir(missing.path)
  expect(await enumerateVault(missing)).toMatchObject({ succeeded: true })
})
