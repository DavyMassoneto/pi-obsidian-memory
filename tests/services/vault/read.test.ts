import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { readNote } from "#src/services"
import {
  aLimits,
  aNote,
  frontmatterLinesWithListKey,
  linkFolder,
  putNoteFile,
  tryLinkFile,
  useTempFolder,
  validFrontmatterLines,
} from "#test-helpers"

const limits = aLimits()

test("reads a note and the hash of its bytes, accents and emoji included", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), body: "Café — pnpm é obrigatório 🚀" }
  const text = renderNote(note)
  await putNoteFile(vault, "pnpm", note.statement, text)

  expect(await readNote({ path: vault, limits }, "pnpm", note.statement)).toEqual({
    succeeded: true,
    output: { note, hash: createHash("sha256").update(text).digest("hex") },
  })
})

test("reads a note in a nested folder", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  await putNoteFile(vault, "tools/pnpm", note.statement, renderNote(note))

  expect(await readNote({ path: vault, limits }, "tools/pnpm", note.statement)).toMatchObject({
    succeeded: true,
    output: { note },
  })
})

test("tells when the note does not exist", async () => {
  const vault = await useTempFolder()

  expect(await readNote({ path: vault, limits }, "pnpm", "Missing note")).toEqual({
    succeeded: false,
    reason: "not-found",
    problems: ["pnpm/Missing note.md does not exist"],
  })
})

test("tells when the note on disk is invalid, with every problem", async () => {
  const vault = await useTempFolder()
  await putNoteFile(vault, "pnpm", "Broken", "No frontmatter here.\n")

  expect(await readNote({ path: vault, limits }, "pnpm", "Broken")).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["missing frontmatter"],
  })
})

test("refuses to read through a link that leads outside the vault", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  const note = aNote()
  await putNoteFile(outside, "", note.statement, renderNote(note))
  await linkFolder(outside, join(vault, "escape"))

  expect(await readNote({ path: vault, limits }, "escape", note.statement)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test("refuses to read a note that is a file link leading outside the vault", async (context) => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  const note = aNote()
  await putNoteFile(outside, "", note.statement, renderNote(note))
  await mkdir(join(vault, "pnpm"))
  const linked = await tryLinkFile(join(outside, `${note.statement}.md`), join(vault, "pnpm", `${note.statement}.md`))
  if (!linked) {
    context.skip("this system cannot create file links")
  }

  expect(await readNote({ path: vault, limits }, "pnpm", note.statement)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: [`pnpm/${note.statement}.md leads outside the vault`],
  })
})

test("returns a note that breaks a rule with its content and every problem, to be fixed", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), body: "" }
  const text = renderNote(note)
  await putNoteFile(vault, "pnpm", note.statement, text)

  expect(await readNote({ path: vault, limits }, "pnpm", note.statement)).toEqual({
    succeeded: false,
    reason: "needs-fixing",
    problems: ["body: is empty"],
    parsed: {
      statement: note.statement,
      frontmatter: expect.stringContaining("id: 01JABCDE7XKQ2M9V3RTN8WPZ5F"),
      body: "",
    },
    hash: createHash("sha256").update(text).digest("hex"),
  })
})

test("returns a note with a broken frontmatter with its content and every problem", async () => {
  const vault = await useTempFolder()
  await putNoteFile(
    vault,
    "pnpm",
    "Broken",
    "---\nid: 12345\ntype: rule\ncreated: 2026-10-04\nupdated: 2026-10-04\n---\n",
  )

  expect(await readNote({ path: vault, limits }, "pnpm", "Broken")).toMatchObject({
    succeeded: false,
    reason: "needs-fixing",
    problems: [expect.stringMatching(/^id:/), "body: is empty"],
    parsed: { statement: "Broken", body: "" },
  })
})

test.each([
  ["a list", "- id", /^frontmatter: must be fields \(name: value\)$/],
  ["a single value", "just text", /^frontmatter: must be fields \(name: value\)$/],
  ["nothing", "", /^frontmatter: must be fields \(name: value\)$/],
  ["not valid YAML", "id: [unclosed", /^frontmatter: /],
  ["an alias to nothing", "id: *missing", /^id: is an alias \(\*missing\)/],
  [
    "an ordered map with a repeated key",
    "extra: !!omap [ { &k same: 1 }, { *k : 2 } ]",
    /^extra: remove the tag !!omap$/,
  ],
  ["a field name that is a list", frontmatterLinesWithListKey().join("\n"), /^frontmatter: a field name is not text$/],
  ["tagged as a whole", ["!!map", ...validFrontmatterLines()].join("\n"), /^frontmatter: remove the tag !!map$/],
  [
    "a tagged field name",
    [...validFrontmatterLines(), "!!str extra: 1"].join("\n"),
    /^extra: remove the tag !!str from the name$/,
  ],
  ["a second document", [...validFrontmatterLines(), "...", "type: rule"].join("\n"), /^frontmatter: /],
])("returns a note whose frontmatter is %s with its content, hash and problem", async (_case, yaml, problem) => {
  const vault = await useTempFolder()
  const text = ["---", yaml, "---", "", "Body.", ""].join("\n")
  await putNoteFile(vault, "pnpm", "Odd", text)

  expect(await readNote({ path: vault, limits }, "pnpm", "Odd")).toEqual({
    succeeded: false,
    reason: "needs-fixing",
    problems: expect.arrayContaining([expect.stringMatching(problem)]),
    parsed: { statement: "Odd", frontmatter: yaml, body: "Body." },
    hash: createHash("sha256").update(text).digest("hex"),
  })
})
