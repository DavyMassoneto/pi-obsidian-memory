import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createNote, listFolder } from "#/services"
import {
  aNote,
  frontmatterLinesWithListKey,
  linkFolder,
  noteText,
  useTempVault,
  validFrontmatterLines,
} from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test("lists the subfolders as subjects and the valid notes of a folder", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createNote(vault, "tools", note, limits)
  await mkdir(join(vault, "tools", "pnpm"))

  expect(await listFolder(vault, "tools", limits)).toEqual({
    succeeded: true,
    output: { subjects: ["pnpm"], notes: [note], invalid: [] },
  })
})

test("leaves out the index, hidden files and folders, and files that are not notes", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, ".obsidian"))
  await writeFile(join(vault, "index.md"), "# generated")
  await writeFile(join(vault, ".Use pnpm.md.tmp-123"), "temporary")
  await writeFile(join(vault, "diagram.png"), "image")

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [] },
  })
})

test("leaves out archive and _templates at the vault root", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "archive"))
  await mkdir(join(vault, "_templates"))
  await mkdir(join(vault, "pnpm"))

  expect(await listFolder(vault, "", limits)).toMatchObject({ output: { subjects: ["pnpm"] } })
})

test("lists archive and _templates as ordinary subjects below the root", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "tools", "archive"), { recursive: true })
  await mkdir(join(vault, "tools", "_templates"))

  const listed = await listFolder(vault, "tools", limits)
  if (!listed.succeeded) {
    throw new Error(`listing failed: ${listed.problems.join(", ")}`)
  }

  expect(listed.output.subjects.sort()).toEqual(["_templates", "archive"])
})

test("lists invalid notes with their problems", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Broken.md"), "No frontmatter.\n")

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [{ statement: "Broken", problems: ["missing frontmatter"] }] },
  })
})

test("refuses to list through a link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "escape"))

  expect(await listFolder(vault, "escape", limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test.each([
  ["an empty body", "", { maxBodyChars: 1000, maxStatementChars: 100 }, "body: is empty"],
  [
    "a body over a lowered limit",
    "a".repeat(20),
    { maxBodyChars: 10, maxStatementChars: 100 },
    "body: has 20 characters, the limit is 10",
  ],
])("lists a note with %s as needing a fix", async (_case, body, lowered, problem) => {
  const vault = await useTempVault()
  const note = { ...aNote(), body }
  await writeFile(join(vault, `${note.statement}.md`), renderNote(note))

  expect(await listFolder(vault, "", lowered)).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [{ statement: note.statement, problems: [problem] }] },
  })
})

test("lists a note with a broken frontmatter and an empty body with both problems", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Broken.md"), noteText(["id: 12345", ...validFrontmatterLines().slice(1)], ""))

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [],
      invalid: [{ statement: "Broken", problems: [expect.stringMatching(/^id:/), "body: is empty"] }],
    },
  })
})

test("lists a note whose frontmatter uses an alias, and still lists the other notes", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createNote(vault, "", note, limits)
  await writeFile(join(vault, "Aliased.md"), noteText([...validFrontmatterLines(), "replaces: *missing"], "Body."))

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [note],
      invalid: [{ statement: "Aliased", problems: ["replaces: is an alias (*missing); write the value itself"] }],
    },
  })
})

test("lists a note whose frontmatter has a tagged value, and still lists the other notes", async () => {
  const vault = await useTempVault()
  const note = aNote()
  await createNote(vault, "", note, limits)
  const repeatedKey = "extra: !!omap [ { &k same: 1 }, { *k : 2 } ]"
  await writeFile(join(vault, "Ordered.md"), noteText([...validFrontmatterLines(), repeatedKey], "Body."))

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [note],
      invalid: [{ statement: "Ordered", problems: ["extra: remove the tag !!omap", "extra: not a known field"] }],
    },
  })
})

test("lists a note with a field name that is not text as needing a fix, never as valid", async () => {
  const vault = await useTempVault()
  await writeFile(join(vault, "Keyed.md"), noteText(frontmatterLinesWithListKey(), "Body."))

  expect(await listFolder(vault, "", limits)).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [],
      invalid: [
        {
          statement: "Keyed",
          problems: ["frontmatter: a field name is not text", expect.stringMatching(/^id: must match pattern/)],
        },
      ],
    },
  })
})
