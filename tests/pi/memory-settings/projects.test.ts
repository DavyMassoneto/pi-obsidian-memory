import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { projectLine, SCREEN, savedConfig, screenContext, settingsFixture } from "#test-helpers"

test("the projects line opens the registered projects, each with its folder and vault", async () => {
  const { pi, workingFolder, projectVault } = await settingsFixture()
  const { context, prompts } = screenContext(workingFolder, [SCREEN.projects, undefined, SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect(prompts[1]?.options).toEqual([projectLine(projectVault, workingFolder)])
})

test("repointing a project to an existing folder writes it, adds the templates, keeps its files, and says the memory block waits for /reload", async () => {
  const { pi, workingFolder, projectVault, configPath, root } = await settingsFixture()
  const other = join(root, "Other vault")
  await mkdir(other)
  await writeFile(join(other, "mine.md"), "x")
  const { context, notifications } = screenContext(
    workingFolder,
    [SCREEN.projects, projectLine(projectVault, workingFolder), "Change its vault", SCREEN.done],
    { inputs: [other] },
  )

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).projects).toEqual([{ name: "loja", folder: workingFolder, vault: other }])
  expect((await readdir(other)).sort()).toEqual(["Memory.base", "_templates", "mine.md"])
  expect(notifications).toEqual([{ message: expect.stringMatching(/Saved.*\/reload/s), type: "info" }])
})

test("a folder that does not exist is created with the templates and Memory.base, and the old vault is untouched", async () => {
  const { pi, workingFolder, projectVault, configPath, root } = await settingsFixture()
  const created = join(root, "nowhere")
  const { context } = screenContext(
    workingFolder,
    [SCREEN.projects, projectLine(projectVault, workingFolder), "Change its vault", SCREEN.done],
    { inputs: [created] },
  )

  await pi.runCommand("memory-setup", context)

  expect((await readdir(created)).sort()).toEqual(["Memory.base", "_templates"])
  expect((await savedConfig(configPath)).projects).toEqual([{ name: "loja", folder: workingFolder, vault: created }])
  expect(await readdir(projectVault)).toEqual([])
})

test("removing a project asks nothing: it drops the registration and leaves its vault untouched", async () => {
  const { pi, workingFolder, projectVault, configPath } = await settingsFixture()
  const bytes = Buffer.from([0, 255, 13, 10])
  await writeFile(join(projectVault, "keep.md"), bytes)
  const { context, prompts, notifications } = screenContext(
    workingFolder,
    [SCREEN.projects, projectLine(projectVault, workingFolder), "Remove it from the memory", SCREEN.done],
    {},
  )

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).projects).toEqual([])
  expect(await readFile(join(projectVault, "keep.md"))).toEqual(bytes)
  expect(prompts.filter((prompt) => prompt.kind === "confirm")).toEqual([])
  expect(notifications).toEqual([{ message: expect.stringMatching(/Saved.*\/reload/s), type: "info" }])
  expect(prompts.filter((prompt) => prompt.kind === "select").at(-1)?.options).toContain("Projects: 0")
})

test("with no projects registered the projects line says so and opens nothing to pick", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeFile(configPath, JSON.stringify({ ...config, projects: [] }))
  const { context, notifications, prompts } = screenContext(workingFolder, ["Projects: 0", SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect(notifications).toEqual([{ message: expect.stringContaining("/memory-init"), type: "info" }])
  expect(prompts.filter((prompt) => prompt.kind === "select")).toHaveLength(2)
})
