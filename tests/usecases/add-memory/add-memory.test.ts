import { readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { readNote } from "#/services/vault"
import { addMemory } from "#/usecases/add-memory"
import { aConfig, useTempVault, writeConfig } from "#test-helpers"

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

afterEach(() => {
  vi.useRealTimers()
})

async function setup() {
  const root = await useTempVault()
  const globalVault = join(root, "Global memory")
  const projectVault = join(root, "loja")
  const config = {
    ...aConfig(),
    global: { vault: globalVault },
    projects: [{ name: "loja", folder: "D:/Projects/loja", vault: projectVault }],
  }
  const configPath = await writeConfig(root, config)
  return { root, globalVault, projectVault, configPath }
}

test("saves a global memory in the global vault and refreshes its indexes", async () => {
  const { globalVault, configPath } = await setup()

  const result = await addMemory(
    { scope: "global", folder: "tools/pnpm", draft },
    { configPath, workingFolder: "D:/Downloads" },
  )

  expect(result).toMatchObject({ succeeded: true, output: { vaultName: "Global memory", folder: "tools/pnpm" } })
  expect(await readNote(globalVault, "tools/pnpm", draft.statement)).toMatchObject({ succeeded: true })
  expect(await readFile(join(globalVault, "tools", "pnpm", "index.md"), "utf8")).toContain(draft.statement)
  expect(await readFile(join(globalVault, "index.md"), "utf8")).toContain("# Global memory")
})

test("saves a project memory in the vault of the project pi runs in", async () => {
  const { globalVault, projectVault, configPath } = await setup()

  const result = await addMemory(
    { scope: "project", folder: "pnpm", draft },
    { configPath, workingFolder: "D:/Projects/loja/src" },
  )

  expect(result).toMatchObject({ succeeded: true, output: { vaultName: "loja" } })
  expect(await readNote(projectVault, "pnpm", draft.statement)).toMatchObject({ succeeded: true })
  expect(await readNote(globalVault, "pnpm", draft.statement)).toMatchObject({ reason: "not-found" })
})

test("creates the note today with a fresh id and the don't forget mark when asked", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 6, 10, 0))
  const { configPath } = await setup()

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
  const { root, configPath } = await setup()

  expect(
    await addMemory({ scope: "project", folder: "pnpm", draft }, { configPath, workingFolder: "D:/Downloads" }),
  ).toMatchObject({ succeeded: false, reason: "no-project" })
  expect(await readdir(root)).toEqual(["config.json"])
})

test("tells the memory is not configured when there is no config", async () => {
  const { root } = await setup()

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft },
      { configPath: join(root, "missing.json"), workingFolder: "D:/Downloads" },
    ),
  ).toMatchObject({ succeeded: false, reason: "not-configured" })
})

test("refuses when the config is invalid, writing nothing", async () => {
  const { root, configPath } = await setup()
  await writeFile(configPath, "{ not json")

  expect(
    await addMemory({ scope: "global", folder: "pnpm", draft }, { configPath, workingFolder: "D:/Downloads" }),
  ).toMatchObject({ succeeded: false, reason: "invalid-config" })
  expect(await readdir(root)).toEqual(["config.json"])
})

test("refuses an invalid note with every problem, writing nothing", async () => {
  const { root, configPath } = await setup()

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
  expect(await readdir(root)).toEqual(["config.json"])
})

test("refuses a note whose name is taken and returns the existing note, untouched", async () => {
  const { globalVault, configPath } = await setup()
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
