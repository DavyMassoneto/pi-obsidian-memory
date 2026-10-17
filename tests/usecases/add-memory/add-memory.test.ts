import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#src/domain"
import { readNote } from "#src/services"
import { addMemory } from "#src/usecases"
import { aLimits, aNote, linkFolder, operationContextFor, setupVaults, writeConfig } from "#test-helpers"

const limits = aLimits()

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

test("saves a global memory in the global vault and refreshes its indexes", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()

  const result = await addMemory(
    { scope: "global", folder: "tools/pnpm", draft },
    operationContextFor({ configPath, workingFolder: unregisteredFolder }),
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { vaultName: "Global memory", folder: "tools/pnpm", notePath: `tools/pnpm/${draft.statement}.md` },
  })
  expect(await readNote({ path: globalVault, limits }, "tools/pnpm", draft.statement)).toMatchObject({
    succeeded: true,
  })
  expect(await readFile(join(globalVault, "tools", "pnpm", "index.md"), "utf8")).toContain(draft.statement)
  expect(await readFile(join(globalVault, "index.md"), "utf8")).toContain("# Global memory")
})

test("maintains logical and physical ancestors when saving through a directory alias", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()
  await mkdir(join(globalVault, "physical", "subject"), { recursive: true })
  await linkFolder(join(globalVault, "physical", "subject"), join(globalVault, "alias"))

  const result = await addMemory(
    { scope: "global", folder: "alias", draft },
    operationContextFor({ configPath, workingFolder: unregisteredFolder }),
  )

  expect(result).toMatchObject({ succeeded: true, output: { maintenanceProblems: [] } })
  expect(await readFile(join(globalVault, "physical", "subject", "index.md"), "utf8")).toContain(draft.statement)
  expect(await readFile(join(globalVault, "physical", "index.md"), "utf8")).toContain(
    "[[physical/subject/index|subject]]",
  )
  const rootIndex = await readFile(join(globalVault, "index.md"), "utf8")
  expect(rootIndex).toContain("[[alias/index|alias]]")
  expect(rootIndex).toContain("[[physical/index|physical]]")
})

test("saves a project memory in the vault of the project pi runs in", async () => {
  const { globalVault, projectVault, configPath, projectFolder } = await setupVaults()

  const result = await addMemory(
    { scope: "project", folder: "pnpm", draft },
    operationContextFor({ configPath, workingFolder: join(projectFolder, "src") }),
  )

  expect(result).toMatchObject({ succeeded: true, output: { vaultName: "loja" } })
  expect(await readNote({ path: projectVault, limits }, "pnpm", draft.statement)).toMatchObject({ succeeded: true })
  expect(await readNote({ path: globalVault, limits }, "pnpm", draft.statement)).toMatchObject({ reason: "not-found" })
})

test("refuses the project scope in a folder with no registered project, writing nothing", async () => {
  const { globalVault, projectVault, configPath, unregisteredFolder } = await setupVaults()

  expect(
    await addMemory(
      { scope: "project", folder: "pnpm", draft },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toMatchObject({ succeeded: false, reason: "no-project" })
  expect(await readdir(globalVault)).toEqual([])
  expect(await readdir(projectVault)).toEqual([])
})

test("tells the memory is not configured when there is no config", async () => {
  const { root, unregisteredFolder } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft },
      operationContextFor({ configPath: join(root, "missing.json"), workingFolder: unregisteredFolder }),
    ),
  ).toMatchObject({ succeeded: false, reason: "not-configured" })
})

test("refuses when the config is invalid, writing nothing", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()
  await writeFile(configPath, "{ not json")

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toMatchObject({ succeeded: false, reason: "invalid-config" })
  expect(await readdir(globalVault)).toEqual([])
})

test("refuses an invalid note with every problem, writing nothing", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft: { ...draft, statement: "Use a: b", body: "" } },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['statement: ":" is not allowed in a file name', "body: is empty"],
  })
  expect(await readdir(globalVault)).toEqual([])
})

test("refuses a note whose name is taken and returns the existing note, untouched", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()
  const context = operationContextFor({ configPath, workingFolder: unregisteredFolder })
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
  ["a hidden folder", ".private", ['folder ".private": is hidden (starts with ".")']],
  ["the archive", "Archive/pnpm", ['folder "Archive": is reserved for the vault']],
  ["the templates", "_templates/pnpm", ['folder "_templates": is reserved for the vault']],
])("refuses %s, writing nothing", async (_case, folder, problems) => {
  const { root, globalVault, configPath, unregisteredFolder } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder, draft },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toEqual({
    succeeded: false,
    reason: "invalid",
    problems,
  })
  expect(await readdir(globalVault)).toEqual([])
  expect((await readdir(root)).sort()).toEqual(["Global memory", "config.json", "loja", "work"])
})

test("lists the folder and note problems together", async () => {
  const { configPath, unregisteredFolder } = await setupVaults()

  expect(
    await addMemory(
      { scope: "global", folder: ".private", draft: { ...draft, body: "" } },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder ".private": is hidden (starts with ".")', "body: is empty"],
  })
})

test("refuses a vault folder that does not exist, creating nothing", async () => {
  const { root, globalVault, configPath, unregisteredFolder } = await setupVaults()
  await rm(globalVault, { recursive: true })

  expect(
    await addMemory(
      { scope: "global", folder: "pnpm", draft },
      operationContextFor({ configPath, workingFolder: unregisteredFolder }),
    ),
  ).toEqual({ succeeded: false, reason: "vault-missing", problems: [`the vault folder ${globalVault} does not exist`] })
  expect((await readdir(root)).sort()).toEqual(["config.json", "loja", "work"])
})

test("refreshes the index with the limits from the config", async () => {
  const { root, globalVault, config: originalConfig, unregisteredFolder } = await setupVaults()
  const config = { ...originalConfig, limits: { ...originalConfig.limits, maxBodyChars: 30 } }
  const configPath = await writeConfig(root, config)
  const long = { ...aNote(), statement: "Long note", body: "a".repeat(40) }
  await mkdir(join(globalVault, "pnpm"))
  await writeFile(join(globalVault, "pnpm", "Long note.md"), renderNote(long))

  const result = await addMemory(
    { scope: "global", folder: "pnpm", draft },
    operationContextFor({ configPath, workingFolder: unregisteredFolder }),
  )

  expect(result).toMatchObject({ succeeded: true })
  expect(await readFile(join(globalVault, "pnpm", "index.md"), "utf8")).toContain(
    "## Needs fixing\n\n- [[pnpm/Long note|Long note]] · body: has 40 characters, the limit is 30",
  )
})
