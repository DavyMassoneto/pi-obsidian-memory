import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, listFolder, readNote } from "#/services"
import { aLimits, aNote, linkFolder, tryLinkFile, useTempFolder } from "#test-helpers"

const limits = aLimits()

test.each(["archive", "_templates", ".hidden"])("refuses a memory alias into %s", async (destination) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, destination))
  await linkFolder(join(vault, destination), join(vault, "alias"))

  expect(await createMemoryNote({ path: vault, limits }, "alias/new", aNote())).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readdir(join(vault, destination))).toEqual([])
})

test("refuses an occupied cross-folder file alias with its logical statement", async (context) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "sub"))
  const target = join(vault, "sub", "Target.md")
  await writeFile(target, "user content")
  const alias = join(vault, "Alias.md")
  if (!(await tryLinkFile(target, alias))) {
    context.skip("this system cannot create file links")
    return
  }

  expect(await createMemoryNote({ path: vault, limits }, "", { ...aNote(), statement: "Alias" })).toMatchObject({
    succeeded: false,
    reason: "exists",
    existingStatement: "Alias",
  })
  expect(await readFile(target, "utf8")).toBe("user content")
  expect((await lstat(alias)).isSymbolicLink()).toBe(true)
})

test("publishes only one of concurrent creates without replacing the winner", async () => {
  const vault = await useTempFolder()
  const attempts = Array.from({ length: 12 }, (_, index) => ({ ...aNote(), body: `Writer ${index}` }))
  const results = await Promise.all(attempts.map((note) => createMemoryNote({ path: vault, limits }, "", note)))
  const saved = results.filter((result) => result.succeeded)
  expect(saved).toHaveLength(1)
  const winner = saved[0]
  if (!winner?.succeeded) {
    throw new Error("missing winner")
  }

  expect(await readFile(join(vault, `${aNote().statement}.md`), "utf8")).toBe(renderNote(winner.output.note))
  expect(await readdir(vault)).toEqual([`${aNote().statement}.md`])
})

test.runIf(process.platform === "win32")(
  "reports the actual winning filename after case-insensitive concurrent creation",
  async () => {
    const vault = await useTempFolder()
    const attempts = ["Mixed case", "MIXED CASE", "mixed case"].map((statement) => ({ ...aNote(), statement }))
    const results = await Promise.all(attempts.map((note) => createMemoryNote({ path: vault, limits }, "", note)))
    const files = await readdir(vault)
    expect(files).toHaveLength(1)
    const expectedStatement = files[0]?.slice(0, -3)
    for (const result of results) {
      if (!result.succeeded) {
        expect(result).toMatchObject({ reason: "exists", existingStatement: expectedStatement })
      }
    }
  },
)

test("lists a successfully created dot-prefixed note", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), statement: ".Invisible" }

  expect(await createMemoryNote({ path: vault, limits }, "", note)).toMatchObject({ succeeded: true })
  expect(await listFolder({ path: vault, limits }, "")).toMatchObject({ output: { notes: [note] } })
})

test("reports logical folder and note validation problems together", async () => {
  const vault = await useTempFolder()

  expect(await createMemoryNote({ path: vault, limits }, "archive", { ...aNote(), body: "" })).toMatchObject({
    reason: "invalid",
    problems: ['folder "archive": is reserved for the vault', "body: is empty"],
  })
  expect(await readdir(vault)).toEqual([])
})

test("writes the note in its subject folder, creating the missing folders", async () => {
  const vault = await useTempFolder()
  const note = aNote()

  await createMemoryNote({ path: vault, limits }, "tools/pnpm", note)

  expect(await readFile(join(vault, "tools/pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

test("returns the hash of what it wrote, the same a later read sees", async () => {
  const vault = await useTempFolder()
  const note = aNote()

  const created = await createMemoryNote({ path: vault, limits }, "pnpm", note)
  const read = await readNote({ path: vault, limits }, "pnpm", note.statement)

  expect(created).toEqual(read)
})

test("refuses an invalid note and writes nothing", async () => {
  const vault = await useTempFolder()
  const note = { ...aNote(), body: "" }

  expect(await createMemoryNote({ path: vault, limits }, "pnpm", note)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["body: is empty"],
  })
  expect(await readdir(vault)).toEqual([])
})

test.each([
  ["the same name", "Use pnpm, never npm"],
  ["the same name in another case", "USE PNPM, NEVER NPM"],
])("refuses when a note with %s already exists, leaving it untouched", async (_case, existing) => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "pnpm"))
  await writeFile(join(vault, "pnpm", `${existing}.md`), "user content")

  expect(await createMemoryNote({ path: vault, limits }, "pnpm", aNote())).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: existing,
    problems: [`pnpm/${existing}.md already exists`],
  })
  expect(await readFile(join(vault, "pnpm", `${existing}.md`), "utf8")).toBe("user content")
})

test("leaves no temporary file behind", async () => {
  const vault = await useTempFolder()
  const note = aNote()

  await createMemoryNote({ path: vault, limits }, "pnpm", note)

  expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
})

test("refuses a folder that leaves the vault, writing nothing outside", async () => {
  const root = await useTempFolder()
  const vault = join(root, "vault")
  await mkdir(vault)

  expect(await createMemoryNote({ path: vault, limits }, "../other", aNote())).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder: ".." is not allowed'],
  })
  expect(await readdir(root)).toEqual(["vault"])
})

test("refuses to write through a link that leads outside the vault, writing nothing outside", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "escape"))

  expect(await createMemoryNote({ path: vault, limits }, "escape/pnpm", aNote())).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
  expect(await readdir(outside)).toEqual([])
})

test("refuses a vault folder that does not exist, creating nothing", async () => {
  const root = await useTempFolder()
  const vault = join(root, "missing")

  expect(await createMemoryNote({ path: vault, limits }, "pnpm", aNote())).toEqual({
    succeeded: false,
    reason: "vault-missing",
    problems: [`the vault folder ${vault} does not exist`],
  })
  expect(await readdir(root)).toEqual([])
})

test("refuses a frontmatter the format does not allow, writing nothing", async () => {
  const vault = await useTempFolder()
  const note = aNote()
  const invalid = { ...note, frontmatter: { ...note.frontmatter, id: "not-a-ulid" } }

  expect(await createMemoryNote({ path: vault, limits }, "pnpm", invalid)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["id: must be a ULID"],
  })
  expect(await readdir(vault)).toEqual([])
})
