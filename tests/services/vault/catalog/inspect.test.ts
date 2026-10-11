import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { inspectVaultFile } from "#/services"
import { catalogVault, linkFolder, noteText, putCatalogFile, validFrontmatterLines } from "#test-helpers"

test("retains exact byte hash and stat while parsed invalid names and bodies remain searchable", async () => {
  const vault = await catalogVault()
  vault.limits.maxBodyChars = 2
  const text = noteText(validFrontmatterLines(), " full body ").replaceAll("\n", "\r\n")
  await putCatalogFile(vault, "[bad].md", text)
  const result = await inspectVaultFile(vault, { path: "[bad].md" })
  expect(result.succeeded).toBe(true)
  if (!result.succeeded) return
  expect(result.output).toMatchObject({
    path: "[bad].md",
    text,
    rawHash: createHash("sha256").update(text).digest("hex"),
    stat: { size: Buffer.byteLength(text) },
    analysis: {
      status: "parsed",
      searchable: true,
      needsFixing: true,
      parsed: { body: " full body " },
      frontmatterProblems: [],
    },
  })
  expect(result.output.analysis.nameProblems.length).toBeGreaterThan(0)
  expect(result.output.analysis.bodyProblems.length).toBeGreaterThan(0)
  expect(await readFile(join(vault.path, "[bad].md"), "utf8")).toBe(text)
})

test("invalid and unclosed frontmatter stay inspectable but not searchable; all problems survive", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "bad.md", noteText([...validFrontmatterLines(), "unknown: x"], ""))
  await putCatalogFile(vault, "blank.md", "")
  const invalid = await inspectVaultFile(vault, { path: "bad.md" })
  expect(invalid.succeeded).toBe(true)
  if (!invalid.succeeded) return
  expect(invalid.output.analysis).toMatchObject({
    status: "parsed",
    searchable: false,
    needsFixing: true,
    bodyProblems: ["body: is empty"],
  })
  expect(invalid.output.analysis.frontmatterProblems).toContain("unknown: not a known field")
  expect(await inspectVaultFile(vault, { path: "blank.md" })).toMatchObject({
    succeeded: true,
    output: { text: "", analysis: { status: "unclosed", searchable: false } },
  })
})

test("lexical reserved roots still apply when those folders alias ordinary subjects", async () => {
  const vault = await catalogVault()
  await putCatalogFile(vault, "subject/a.md", noteText(validFrontmatterLines(), "body"))
  await linkFolder(join(vault.path, "subject"), join(vault.path, "_templates"))
  await linkFolder(join(vault.path, "subject"), join(vault.path, "archive"))
  expect(await inspectVaultFile(vault, { path: "_templates/a.md" })).toMatchObject({
    succeeded: false,
    reason: "excluded",
  })
  expect(await inspectVaultFile(vault, { path: "archive/a.md" })).toMatchObject({
    succeeded: true,
    output: { archived: true, analysis: { searchable: false } },
  })
})

test("root reserved aliases never become active memory; nested reserved folders remain subjects", async () => {
  const vault = await catalogVault()
  const text = noteText(validFrontmatterLines(), "body")
  await putCatalogFile(vault, "archive/a.md", text)
  await putCatalogFile(vault, "_templates/rule.md", text)
  await putCatalogFile(vault, "topic/archive/a.md", text)
  await linkFolder(join(vault.path, "archive"), join(vault.path, "old"))
  await linkFolder(join(vault.path, "_templates"), join(vault.path, "templates-alias"))
  expect(await inspectVaultFile(vault, { path: "old/a.md" })).toMatchObject({
    succeeded: true,
    output: { canonicalPath: "archive/a.md", archived: true, analysis: { searchable: false } },
  })
  expect(await inspectVaultFile(vault, { path: "templates-alias/rule.md" })).toMatchObject({
    succeeded: false,
    reason: "excluded",
  })
  expect(await inspectVaultFile(vault, { path: "topic/archive/a.md" })).toMatchObject({
    succeeded: true,
    output: { archived: false, analysis: { searchable: true } },
  })
  expect(await inspectVaultFile(vault, { path: "../escape.md" })).toMatchObject({
    succeeded: false,
    reason: "invalid-path",
  })
})
