import { createHash } from "node:crypto"
import { realpath, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import type { MemoryScope } from "#src/services"
import { type GetMemoryRequest, getMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  linkFolder,
  memoryReadFixture,
  memoryReadTree,
  noteText,
  putCatalogFile,
  tryLinkFile,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test.each(["Note.MD", "Note.mD", ".Rule.md", ".md", "[bad].md", "archive/Note.md"])(
  "delivers exact %s text, diagnostics, identity and session receipt without writes",
  async (path) => {
    const { root, vault, context } = await memoryReadFixture()
    const text = noteText(validFrontmatterLines(), " full body  \n").replaceAll("\n", "\r\n")
    await putCatalogFile(vault, path, text)
    const before = await memoryReadTree(root)
    const result = await getMemory({ vault: "global", path, sourceCallId: "get-one" }, context)
    expect(result).toMatchObject({ succeeded: true, output: { kind: "note", file: { path, text } } })
    const receipt = context.session.getReceipt(context.stamp, { vault: "global", path })
    expect(receipt).toMatchObject({
      path,
      canonicalPath: path,
      canonicalVault: await realpath(vault.path),
      sourceCallId: "get-one",
      text,
      rawHash: createHash("sha256").update(text).digest("hex"),
      stat: { size: Buffer.byteLength(text) },
    })
    expect(await memoryReadTree(root)).toEqual(before)
    await expectRegistrationLeaseReleased(context)
  },
)

test("get selects project independently of global and binds the canonical configured vault alias", async () => {
  const { root, vault, context, config } = await memoryReadFixture()
  const project = { path: join(root, "project"), limits: config.limits }
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "global"))
  await putCatalogFile(project, "Note.md", noteText(validFrontmatterLines(), "project"))
  await linkFolder(project.path, join(root, "project-alias"))
  config.projects = [{ name: "project", folder: context.workingFolder, vault: join(root, "project-alias") }]
  await writeRegistrationSnapshot(context, JSON.stringify(config))
  const scopes: MemoryScope[] = ["global", "project"]
  for (const scope of scopes) {
    expect(await getMemory({ vault: scope, path: "Note.md", sourceCallId: scope }, context)).toMatchObject({
      succeeded: true,
      output: { file: { analysis: { parsed: { body: scope } } } },
    })
  }
  expect(context.session.getReceipt(context.stamp, { vault: "project", path: "Note.md" })).toMatchObject({
    canonicalVault: await realpath(project.path),
  })
})

test("closed invalid frontmatter/name/body is diagnostic read with nullable metadata and every problem", async () => {
  const { vault, context } = await memoryReadFixture()
  const text = noteText([...validFrontmatterLines(), "unknown: x"], "")
  await putCatalogFile(vault, "[bad].md", text)
  const result = await getMemory({ vault: "global", path: "[bad].md", sourceCallId: "invalid" }, context)
  expect(result.succeeded).toBe(true)
  const receipt = context.session.getReceipt(context.stamp, { vault: "global", path: "[bad].md" })
  expect(receipt).toMatchObject({ id: null, text, analysis: { frontmatter: null, searchable: false } })
  expect(receipt?.analysis.frontmatterProblems).toContain("unknown: not a known field")
  expect(receipt?.analysis.nameProblems.length).toBeGreaterThan(0)
  expect(receipt?.analysis.bodyProblems).toEqual(["body: is empty"])
})

test.each(["", " \n\t", "---\ntype: rule\nnot closed"])(
  "unclosed text refuses with diagnostics and consumes prior receipt",
  async (text) => {
    const { vault, context } = await memoryReadFixture()
    const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "first" }
    await putCatalogFile(vault, request.path, noteText(validFrontmatterLines(), "body"))
    expect((await getMemory(request, context)).succeeded).toBe(true)
    await putCatalogFile(vault, request.path, text)
    const result = await getMemory(request, context)
    expect(result).toMatchObject({
      succeeded: false,
      reason: "unclosed-frontmatter",
      file: { text, analysis: { status: "unclosed" } },
    })
    expect(context.session.getReceipt(context.stamp, request)).toBeNull()
    await expectRegistrationLeaseReleased(context)
  },
)

test("duplicate ids stay path-independent, latest get replaces only its receipt and result mutation cannot alter it", async () => {
  const { vault, context } = await memoryReadFixture()
  for (const path of ["one.md", "two.md"]) {
    await putCatalogFile(vault, path, noteText(validFrontmatterLines(), path))
    await getMemory({ vault: "global", path, sourceCallId: path }, context)
  }
  await putCatalogFile(vault, "one.md", noteText(validFrontmatterLines(), "new"))
  const result = await getMemory({ vault: "global", path: "one.md", sourceCallId: "latest" }, context)
  if (!result.succeeded || result.output.kind !== "note") throw new Error("note required")
  result.output.file.text = "mutated"
  result.output.file.stat.size = 0
  result.output.file.analysis.bodyProblems.push("mutated")
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "one.md" })).toMatchObject({
    sourceCallId: "latest",
    analysis: { parsed: { body: "new" }, bodyProblems: [] },
  })
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "two.md" })).toMatchObject({
    sourceCallId: "two.md",
    analysis: { parsed: { body: "two.md" } },
  })
  await rm(join(vault.path, "one.md"))
  expect(await getMemory({ vault: "global", path: "one.md", sourceCallId: "missing" }, context)).toMatchObject({
    succeeded: false,
    reason: "not-found",
  })
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "one.md" })).toBeNull()
})

test("full over-limit body is never truncated to a model or note limit", async () => {
  const { vault, context } = await memoryReadFixture()
  const body = "Detailed memory. ".repeat(1200)
  const text = noteText(validFrontmatterLines(), body)
  await putCatalogFile(vault, "Long.md", text)
  const result = await getMemory({ vault: "global", path: "Long.md", sourceCallId: "long" }, context)
  expect(result).toMatchObject({ succeeded: true, output: { file: { text, analysis: { parsed: { body } } } } })
  const receipt = context.session.getReceipt(context.stamp, { vault: "global", path: "Long.md" })
  expect(receipt?.text).toBe(text)
  expect(receipt?.analysis.bodyProblems.length).toBeGreaterThan(0)
})

test("directory and file aliases preserve requested paths and canonical identity", async (testContext) => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "physical/Note.MD", noteText(validFrontmatterLines(), "body"))
  await linkFolder(join(vault.path, "physical"), join(vault.path, "alias"))
  await getMemory({ vault: "global", path: "alias/Note.MD", sourceCallId: "directory" }, context)
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "alias/Note.MD" })).toMatchObject({
    canonicalPath: "physical/Note.MD",
  })
  if (!(await tryLinkFile(join(vault.path, "physical/Note.MD"), join(vault.path, "File.md"))))
    testContext.skip("this system cannot create file links")
  await getMemory({ vault: "global", path: "File.md", sourceCallId: "file" }, context)
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "File.md" })).toMatchObject({
    canonicalPath: "physical/Note.MD",
  })
})
