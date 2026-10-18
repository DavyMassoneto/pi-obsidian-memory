import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readConfig } from "#src/services"
import { customizedSettings, memoryConfigAt, registrationFixture, testPlatform, useTempFolder } from "#test-helpers"

test("old config is refused without migration or partial settings while its exact bytes survive", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "config.json")
  const text = JSON.stringify({
    global: { vault: join(folder, "vault") },
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  })
  await writeFile(path, text)
  const result = await readConfig(path, testPlatform())
  expect(result).toMatchObject({ succeeded: false, reason: "invalid-config" })
  expect(result).not.toHaveProperty("output")
  if (result.succeeded) throw new Error("old config accepted")
  for (const field of ["maxNotesPerFolder", "capture", "memoryAgent", "context", "embeddings", "decisionModel"]) {
    expect(result.problems.join(" ")).toContain(field)
  }
  expect(await readFile(path, "utf8")).toBe(text)
})

test("reading configured remote choices neither defaults nor requires credentials", async () => {
  const folder = await useTempFolder()
  const config = { ...memoryConfigAt(folder), ...customizedSettings() }
  const path = join(folder, "config.json")
  const text = JSON.stringify(config)
  await writeFile(path, text)
  expect(await readConfig(path, testPlatform())).toEqual({ succeeded: true, output: config })
  expect(await readFile(path, "utf8")).toBe(text)
})

test("reads a valid config file", async () => {
  const fixture = await registrationFixture()
  try {
    await mkdir(join(fixture.root, "machine"))
    await writeFile(fixture.path, JSON.stringify(fixture.config, null, 2))
    expect(await readConfig(fixture.path, fixture.platform)).toEqual({ succeeded: true, output: fixture.config })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("tells the memory is not configured when the file does not exist", async () => {
  const folder = await useTempFolder()

  expect(await readConfig(join(folder, "config.json"), testPlatform())).toEqual({
    succeeded: false,
    reason: "not-configured",
    configPath: join(folder, "config.json"),
    problems: ["memory is not configured"],
  })
})

test("refuses hand-edited junction vault overlaps without changing config or vault bytes", async () => {
  const fixture = await registrationFixture()
  try {
    const alias = join(fixture.root, "alias")
    await symlink(fixture.config.global.vault, alias, "junction")
    fixture.config.projects[0] = { name: "alias", folder: join(fixture.root, "work"), vault: join(alias, "new") }
    await mkdir(join(fixture.root, "machine"))
    const text = JSON.stringify(fixture.config)
    await writeFile(fixture.path, text)
    expect(await readConfig(fixture.path, fixture.platform)).toMatchObject({
      succeeded: false,
      reason: "invalid-config",
    })
    expect(await readFile(fixture.path, "utf8")).toBe(text)
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("refuses an invalid file with every problem", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify({ ...memoryConfigAt(folder), theme: "dark" }))

  expect(await readConfig(path, testPlatform())).toEqual({
    succeeded: false,
    reason: "invalid-config",
    configPath: path,
    problems: ["theme: not a known field"],
  })
})

test("reports an unreadable config path with its cause instead of throwing", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "config.json")
  await mkdir(path)

  expect(await readConfig(path, testPlatform())).toEqual({
    succeeded: false,
    reason: "unreadable",
    configPath: path,
    code: "EISDIR",
    problems: [`${path}: cannot read config (EISDIR)`],
  })
})
