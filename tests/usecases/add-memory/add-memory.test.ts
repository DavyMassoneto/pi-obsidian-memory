import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { renderNote } from "#/domain"
import { readNote } from "#/services"
import { addMemory } from "#/usecases"
import { aConfig, aNote, setupVaults, writeConfig } from "#test-helpers"

const limits = { maxBodyChars: 1000, maxStatementChars: 100 }

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

afterEach(() => {
  vi.useRealTimers()
})

test("saves a global memory in the global vault and refreshes its indexes", async () => {
  const { globalVault, configPath } = await setupVaults()

  const result = await addMemory(
    { scope: "global", folder: "tools/pnpm", draft },
    { configPath, workingFolder: "D:/Downloads" },
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { vaultName: "Global memory", folder: "tools/pnpm", notePath: `tools/pnpm/${draft.statement}.md` },
  })
  expect(await readNote(globalVault, "tools/pnpm", draft.statement, limits)).toMatchObject({ succeeded: true })
  expect(await readFile(join(globalVault, "tools", "pnpm", "index.md"), "utf8")).toContain(draft.statement)
  expect(await readFile(join(globalVault, "index.md"), "utf8")).toContain("# Global memory")
})

test("saves a project memory in the vault of the project pi runs in", async () => {
  const { globalVault, projectVault, configPath } = await setupVaults()

  const result = await addMemory(
    { scope: "project", folder: "pnpm", draft },
    { configPath, workingFolder: "D:/Projects/loja/src" },
  )

  expect(result).toMatchObject({ succeeded: true, output: { vaultName: "loja" } })
  expect(await readNote(projectVault, "pnpm", draft.statement, limits)).toMatchObject({ succeeded: true })
  expect(await readNote(globalVault, "pnpm", draft.statement, limits)).toMatchObject({ reason: "not-found" })
})

test("creates the note today with a fresh id and the don't forget mark when asked", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 6, 10, 0))
  const { configPath } = await setupVaults()

  const result = await addMemory(
    { scope: "global", folder: "pnpm", draft: { ...draft, dontForget: true } },
    { configPath, workingFolder: "D:/Downloads" },
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { stored: { note: { frontmatter: { created: "2026-10-06", updated: "2026-10-06", dontForget: true } } } },
  })
})

test("refuses the project scope in a folder with no registered project, writing nothing", async () => {
  const { globalVault, projectVault, configPath } = await setupVaults()

  expect(
    await addMemory({ scope: "project", folder: "pnpm", draft }, { configPath, workingFolder: "D:/Downloads" }),
  ).toMatchObject({ succeeded: false, reason: "no-project" })
  expect(await readdir(globalVault)).toEqual([])
  expect(await readdir(projectVault)).toEqual([])
})

test("tells the memory is not configured when there is no config", async () => {
  const { root } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft },
      { configPath: join(root, "missing.json"), workingFolder: "D:/Downloads" },
    ),
  ).toMatchObject({ succeeded: false, reason: "not-configured" })
})

test("refuses when the config is invalid, writing nothing", async () => {
  const { globalVault, configPath } = await setupVaults()
  await writeFile(configPath, "{ not json")

  expect(
    await addMemory({ scope: "global", folder: "pnpm", draft }, { configPath, workingFolder: "D:/Downloads" }),
  ).toMatchObject({ succeeded: false, reason: "invalid-config" })
  expect(await readdir(globalVault)).toEqual([])
})

test("refuses an invalid note with every problem, writing nothing", async () => {
  const { globalVault, configPath } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft: { ...draft, statement: "Use a: b", body: "" } },
      { configPath, workingFolder: "D:/Downloads" },
    ),
  ).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['statement: ":" is not allowed in a file name', "body: is empty"],
  })
  expect(await readdir(globalVault)).toEqual([])
})

test("refuses a note whose name is taken and returns the existing note, untouched", async () => {
  const { globalVault, configPath } = await setupVaults()
  const context = { configPath, workingFolder: "D:/Downloads" }
  const first = await addMemory({ scope: "global", folder: "pnpm", draft }, context)
  if (!first.succeeded) {
    throw new Error(`setup failed: ${first.problems.join(", ")}`)
  }

  const file = join(globalVault, "pnpm", `${draft.statement}.md`)
  const before = await readFile(file, "utf8")

  const again = await addMemory(
    { scope: "global", folder: "pnpm", draft: { ...draft, statement: draft.statement.toLowerCase(), body: "Other." } },
    context,
  )

  expect(again).toEqual({
    succeeded: false,
    reason: "exists",
    problems: [`pnpm/${draft.statement}.md already exists`],
    existing: first.output.stored,
  })
  expect(await readFile(file, "utf8")).toBe(before)
})

test.each([
  ["a folder outside the vault", "../other", ['folder: ".." is not allowed']],
  ["the parent folder", "..", ['folder: ".." is not allowed']],
  ["an absolute path", "/pnpm", ["folder: must be relative to the vault"]],
  ["a drive letter", "C:/pnpm", ["folder: must be relative to the vault"]],
  ["a backslash", "tools\\pnpm", ['folder: use "/" between folders']],
  ["a nested hidden folder", "tools/.private", ['folder ".private": is hidden (starts with ".")']],
  ["a hidden folder", ".private", ['folder ".private": is hidden (starts with ".")']],
  ["the archive", "Archive/pnpm", ['folder "Archive": is reserved for the vault']],
  ["the templates", "_templates/pnpm", ['folder "_templates": is reserved for the vault']],
])("refuses %s, writing nothing", async (_case, folder, problems) => {
  const { root, globalVault, configPath } = await setupVaults()

  expect(await addMemory({ scope: "global", folder, draft }, { configPath, workingFolder: "D:/Downloads" })).toEqual({
    succeeded: false,
    reason: "invalid",
    problems,
  })
  expect(await readdir(globalVault)).toEqual([])
  expect((await readdir(root)).sort()).toEqual(["Global memory", "config.json", "loja"])
})

test("lists the folder and note problems together", async () => {
  const { configPath } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: ".private", draft: { ...draft, body: "" } },
      { configPath, workingFolder: "D:/Downloads" },
    ),
  ).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder ".private": is hidden (starts with ".")', "body: is empty"],
  })
})

test("refuses a vault folder that does not exist, creating nothing", async () => {
  const { root, globalVault, configPath } = await setupVaults()
  await rm(globalVault, { recursive: true })

  expect(
    await addMemory({ scope: "global", folder: "pnpm", draft }, { configPath, workingFolder: "D:/Downloads" }),
  ).toEqual({ succeeded: false, reason: "vault-missing", problems: [`the vault folder ${globalVault} does not exist`] })
  expect((await readdir(root)).sort()).toEqual(["config.json", "loja"])
})

test("refreshes the index with the limits from the config", async () => {
  const { root, globalVault } = await setupVaults()
  const config = { ...aConfig(), global: { vault: globalVault }, limits: { maxBodyChars: 30, maxStatementChars: 100 } }
  const configPath = await writeConfig(root, config)
  const long = { ...aNote(), statement: "Long note", body: "a".repeat(40) }
  await mkdir(join(globalVault, "pnpm"))
  await writeFile(join(globalVault, "pnpm", "Long note.md"), renderNote(long))

  const result = await addMemory(
    { scope: "global", folder: "pnpm", draft },
    { configPath, workingFolder: "D:/Downloads" },
  )

  expect(result).toMatchObject({ succeeded: true })
  expect(await readFile(join(globalVault, "pnpm", "index.md"), "utf8")).toContain(
    "## Needs fixing\n\n- [[pnpm/Long note|Long note]] · body: has 40 characters, the limit is 30",
  )
})
