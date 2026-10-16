import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { createMemoryNote, listFolder } from "#src/services"
import {
  aLimits,
  aNote,
  frontmatterLinesWithListKey,
  linkFolder,
  noteText,
  tryLinkFile,
  useTempFolder,
  validFrontmatterLines,
} from "#test-helpers"

const limits = aLimits()

test("returns a refusal for a missing folder", async () => {
  const vault = await useTempFolder()

  expect(await listFolder({ path: vault, limits }, "missing")).toMatchObject({ succeeded: false, reason: "not-found" })
})

test.each(["blocker", "blocker/deep"])("refuses a file in folder path %s", async (folder) => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "blocker"), "user file")

  expect(await listFolder({ path: vault, limits }, folder)).toMatchObject({ succeeded: false, reason: "not-directory" })
})

test("lists internal folder junctions as subjects", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "target"))
  await linkFolder(join(vault, "target"), join(vault, "alias"))

  expect(await listFolder({ path: vault, limits }, "")).toMatchObject({ output: { subjects: ["alias", "target"] } })
})

test("lists internal file aliases and reports external file aliases", async (context) => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await writeFile(join(vault, "Target.md"), renderNote(aNote()))
  await writeFile(join(outside, "Secret.md"), "outside")
  if (!(await tryLinkFile(join(vault, "Target.md"), join(vault, "Alias.md")))) {
    context.skip("this system cannot create file links")
    return
  }
  await tryLinkFile(join(outside, "Secret.md"), join(vault, "External.md"))

  expect(await listFolder({ path: vault, limits }, "")).toMatchObject({
    output: {
      notes: [expect.objectContaining({ statement: "Alias" }), expect.objectContaining({ statement: "Target" })],
      invalid: [{ statement: "External", problems: ["External.md leads outside the vault"] }],
    },
  })
})

test("reports external and broken folder links without inventing note entries", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "external"))
  await mkdir(join(vault, "gone"))
  await linkFolder(join(vault, "gone"), join(vault, "broken"))
  await rm(join(vault, "gone"), { recursive: true })

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [],
      invalid: [],
      problemFolders: [
        { folder: "broken", problems: ["broken is a link that does not resolve"] },
        { folder: "external", problems: ["external leads outside the vault"] },
      ],
    },
  })
})

test("lists the subfolders as subjects and the valid notes of a folder", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  await createMemoryNote({ path: vault, limits }, "tools", note)
  await mkdir(join(vault, "tools", "pnpm"))

  expect(await listFolder({ path: vault, limits }, "tools")).toEqual({
    succeeded: true,
    output: { subjects: ["pnpm"], notes: [note], invalid: [] },
  })
})

test("leaves out the index, hidden files and folders, and files that are not notes", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, ".obsidian"))
  await writeFile(join(vault, "index.md"), "# generated")
  await writeFile(join(vault, ".Use pnpm.md.tmp-123"), "temporary")
  await writeFile(join(vault, "diagram.png"), "image")

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [] },
  })
})

test("leaves out archive and _templates at the vault root", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "archive"))
  await mkdir(join(vault, "_templates"))
  await mkdir(join(vault, "pnpm"))

  expect(await listFolder({ path: vault, limits }, "")).toMatchObject({ output: { subjects: ["pnpm"] } })
})

test("lists archive and _templates as ordinary subjects below the root", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "tools", "archive"), { recursive: true })
  await mkdir(join(vault, "tools", "_templates"))

  const listed = await listFolder({ path: vault, limits }, "tools")
  if (!listed.succeeded) {
    throw new Error(`listing failed: ${listed.problems.join(", ")}`)
  }

  expect(listed.output.subjects.sort()).toEqual(["_templates", "archive"])
})

test("lists invalid notes with their problems", async () => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "Broken.md"), "No frontmatter.\n")

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [{ statement: "Broken", problems: ["missing frontmatter"] }] },
  })
})

test("refuses to list through a link that leads outside the vault", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "escape"))

  expect(await listFolder({ path: vault, limits }, "escape")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test.each([
  ["an empty body", "", aLimits(), "body: is empty"],
  [
    "a body over a lowered limit",
    "a".repeat(20),
    { ...aLimits(), maxBodyChars: 10 },
    "body: has 20 characters, the limit is 10",
  ],
])("lists a note with %s as needing a fix", async (_case, body, lowered, problem) => {
  const vault = await useTempFolder()
  const note = { ...aNote(), body }
  await writeFile(join(vault, `${note.statement}.md`), renderNote(note))

  expect(await listFolder({ path: vault, limits: lowered }, "")).toEqual({
    succeeded: true,
    output: { subjects: [], notes: [], invalid: [{ statement: note.statement, problems: [problem] }] },
  })
})

test("lists a note with a broken frontmatter and an empty body with both problems", async () => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "Broken.md"), noteText(["id: 12345", ...validFrontmatterLines().slice(1)], ""))

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [],
      invalid: [{ statement: "Broken", problems: [expect.stringMatching(/^id:/), "body: is empty"] }],
    },
  })
})

test("lists a note whose frontmatter uses an alias, and still lists the other notes", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  await createMemoryNote({ path: vault, limits }, "", note)
  await writeFile(join(vault, "Aliased.md"), noteText([...validFrontmatterLines(), "replaces: *missing"], "Body."))

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [note],
      invalid: [{ statement: "Aliased", problems: ["replaces: is an alias (*missing); write the value itself"] }],
    },
  })
})

test("lists a note whose frontmatter has a tagged value, and still lists the other notes", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  await createMemoryNote({ path: vault, limits }, "", note)
  const repeatedKey = "extra: !!omap [ { &k same: 1 }, { *k : 2 } ]"
  await writeFile(join(vault, "Ordered.md"), noteText([...validFrontmatterLines(), repeatedKey], "Body."))

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [note],
      invalid: [{ statement: "Ordered", problems: ["extra: remove the tag !!omap", "extra: not a known field"] }],
    },
  })
})

test("lists a note with a field name that is not text as needing a fix, never as valid", async () => {
  const vault = await useTempFolder()
  await writeFile(join(vault, "Keyed.md"), noteText(frontmatterLinesWithListKey(), "Body."))

  expect(await listFolder({ path: vault, limits }, "")).toEqual({
    succeeded: true,
    output: {
      subjects: [],
      notes: [],
      invalid: [
        {
          statement: "Keyed",
          problems: ["frontmatter: a field name is not text", "id: must be a ULID"],
        },
      ],
    },
  })
})
