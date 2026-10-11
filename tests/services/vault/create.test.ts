import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, listFolder, readNote } from "#/services"
import { aNote, linkFolder, useTempVault } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

test.each(["archive", "_templates", ".hidden"])("refuses a memory alias into %s", async (destination) => {
  const vault = await useTempVault()
  await mkdir(join(vault, destination))
  await linkFolder(join(vault, destination), join(vault, "alias"))
  expect(await createMemoryNote(vault, "alias/new", aNote(), limits)).toMatchObject({
    succeeded: false,
    reason: "invalid",
  })
  expect(await readdir(join(vault, destination))).toEqual([])
})

test("publishes only one of concurrent creates without replacing the winner", async () => {
  const vault = await useTempVault()
  const attempts = Array.from({ length: 12 }, (_, index) => ({ ...aNote(), body: `Writer ${index}` }))
  const results = await Promise.all(attempts.map((note) => createMemoryNote(vault, "", note, limits)))
  const saved = results.filter((result) => result.succeeded)
  expect(saved).toHaveLength(1)
  const winner = saved[0]
  if (!winner?.succeeded) throw new Error("missing winner")
  expect(await readFile(join(vault, `${aNote().statement}.md`), "utf8")).toBe(renderNote(winner.output.note))
  expect(await readdir(vault)).toEqual([`${aNote().statement}.md`])
})

test.runIf(process.platform === "win32")(
  "reports the actual winning filename after case-insensitive concurrent creation",
  async () => {
    const vault = await useTempVault()
    const attempts = ["Mixed case", "MIXED CASE", "mixed case"].map((statement) => ({ ...aNote(), statement }))
    const results = await Promise.all(attempts.map((note) => createMemoryNote(vault, "", note, limits)))
    const files = await readdir(vault)
    expect(files).toHaveLength(1)
    const expectedStatement = files[0]?.slice(0, -3)
    for (const result of results) {
      if (!result.succeeded) expect(result).toMatchObject({ reason: "exists", existingStatement: expectedStatement })
    }
  },
)

test("lists a successfully created dot-prefixed note", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), statement: ".Invisible" }
  expect(await createMemoryNote(vault, "", note, limits)).toMatchObject({ succeeded: true })
  expect(await listFolder(vault, "", limits)).toMatchObject({ output: { notes: [note] } })
})

test("reports logical folder and note validation problems together", async () => {
  const vault = await useTempVault()
  expect(await createMemoryNote(vault, "archive", { ...aNote(), body: "" }, limits)).toMatchObject({
    reason: "invalid",
    problems: ['folder "archive": is reserved for the vault', "body: is empty"],
  })
  expect(await readdir(vault)).toEqual([])
})

test("writes the note in its subject folder, creating the missing folders", async () => {
  const vault = await useTempVault()
  const note = aNote()

  await createMemoryNote(vault, "tools/pnpm", note, limits)

  expect(await readFile(join(vault, "tools/pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

test("returns the hash of what it wrote, the same a later read sees", async () => {
  const vault = await useTempVault()
  const note = aNote()

  const created = await createMemoryNote(vault, "pnpm", note, limits)
  const read = await readNote(vault, "pnpm", note.statement, limits)

  expect(created).toEqual(read)
})

test("refuses an invalid note and writes nothing", async () => {
  const vault = await useTempVault()
  const note = { ...aNote(), body: "" }

  expect(await createMemoryNote(vault, "pnpm", note, limits)).toEqual({
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
  const vault = await useTempVault()
  await mkdir(join(vault, "pnpm"))
  await writeFile(join(vault, "pnpm", `${existing}.md`), "user content")

  expect(await createMemoryNote(vault, "pnpm", aNote(), limits)).toEqual({
    succeeded: false,
    reason: "exists",
    existingStatement: existing,
    problems: [`pnpm/${existing}.md already exists`],
  })
  expect(await readFile(join(vault, "pnpm", `${existing}.md`), "utf8")).toBe("user content")
})

test("leaves no temporary file behind", async () => {
  const vault = await useTempVault()
  const note = aNote()

  await createMemoryNote(vault, "pnpm", note, limits)

  expect(await readdir(join(vault, "pnpm"))).toEqual([`${note.statement}.md`])
})

test("refuses a folder that leaves the vault, writing nothing outside", async () => {
  const root = await useTempVault()
  const vault = join(root, "vault")
  await mkdir(vault)

  expect(await createMemoryNote(vault, "../other", aNote(), limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder: ".." is not allowed'],
  })
  expect(await readdir(root)).toEqual(["vault"])
})

test("refuses to write through a link that leads outside the vault, writing nothing outside", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "escape"))

  expect(await createMemoryNote(vault, "escape/pnpm", aNote(), limits)).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
  expect(await readdir(outside)).toEqual([])
})

test("refuses a vault folder that does not exist, creating nothing", async () => {
  const root = await useTempVault()
  const vault = join(root, "missing")

  expect(await createMemoryNote(vault, "pnpm", aNote(), limits)).toEqual({
    succeeded: false,
    reason: "vault-missing",
    problems: [`the vault folder ${vault} does not exist`],
  })
  expect(await readdir(root)).toEqual([])
})

test("refuses a frontmatter the format does not allow, writing nothing", async () => {
  const vault = await useTempVault()
  const note = aNote()
  const invalid = { ...note, frontmatter: { ...note.frontmatter, id: "not-a-ulid" } }

  expect(await createMemoryNote(vault, "pnpm", invalid, limits)).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: [expect.stringMatching(/^id: must match pattern/)],
  })
  expect(await readdir(vault)).toEqual([])
})
