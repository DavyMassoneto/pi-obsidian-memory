import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  DONE_LABEL,
  NO_PROJECTS_NOTICE,
  PROJECT_CHANGE_VAULT,
  PROJECT_REMOVE,
  PROJECT_TITLE,
  PROJECT_VAULT_TITLE,
  projectLabel,
  RELOAD_NOTE,
  SAVED,
  SETTINGS_TITLE,
  settingLines,
} from "#src/pi"
import {
  configuredWorld,
  dialogsTitled,
  leaveScreen,
  onlyProject,
  openProject,
  optionsOf,
  pickLine,
  pressEscape,
  rewriteConfig,
  settingsScreen,
  storedConfig,
} from "#test-helpers"

const TEMPLATES_AND_BASE = ["Memory.base", "_templates"]
const bytes = Buffer.from([0, 255, 13, 10])

test("the projects line opens the registered projects, each with its folder and vault", async () => {
  const world = await configuredWorld({})
  const label = projectLabel(await onlyProject(world))
  await settingsScreen(world, [
    pickLine("Projects:"),
    { method: "select", title: PROJECT_TITLE, answer: pressEscape },
    leaveScreen,
  ])
  expect(optionsOf(world, PROJECT_TITLE)).toEqual([label])
  expect(world.pi.unexpected).toEqual([])
})

test("repointing a project to an existing folder writes it, adds the templates, keeps its files and says the memory block waits for /reload", async () => {
  const world = await configuredWorld({})
  const other = join(world.folders.root, "Other vault")
  await mkdir(other)
  await writeFile(join(other, "mine.md"), "x")
  const steps = await openProject(world, PROJECT_CHANGE_VAULT, [
    { method: "input", title: PROJECT_VAULT_TITLE, answer: { value: other } },
  ])
  const turn = await settingsScreen(world, steps)
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["info"])
  expect(turn.notifications[0]?.message.startsWith(SAVED)).toBe(true)
  expect(turn.notifications[0]?.message).toContain(RELOAD_NOTE)
  expect(await realpath((await onlyProject(world)).vault)).toBe(await realpath(other))
  expect((await readdir(other)).sort()).toEqual([...TEMPLATES_AND_BASE, "mine.md"])
  expect(world.pi.unexpected).toEqual([])
})

test("a vault folder that does not exist is created with the templates and Memory.base, and the old vault is untouched", async () => {
  const world = await configuredWorld({})
  const created = join(world.folders.root, "nowhere")
  const oldVault = (await onlyProject(world)).vault
  const before = await readdir(oldVault)
  const steps = await openProject(world, PROJECT_CHANGE_VAULT, [
    { method: "input", title: PROJECT_VAULT_TITLE, answer: { value: created } },
  ])
  await settingsScreen(world, steps)
  expect((await readdir(created)).sort()).toEqual(TEMPLATES_AND_BASE)
  expect(await realpath((await onlyProject(world)).vault)).toBe(await realpath(created))
  expect(await readdir(oldVault)).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})

test("removing a project asks nothing: it drops the registration and leaves its vault untouched", async () => {
  const world = await configuredWorld({})
  const { vault } = await onlyProject(world)
  await writeFile(join(vault, "keep.md"), bytes)
  const turn = await settingsScreen(world, await openProject(world, PROJECT_REMOVE, []))
  expect((await storedConfig(world)).projects).toEqual([])
  expect(await readFile(join(vault, "keep.md"))).toEqual(bytes)
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["info"])
  expect(turn.notifications[0]?.message).toContain(RELOAD_NOTE)
  const labels = settingLines(await storedConfig(world)).map((line) => line.label)
  expect(dialogsTitled(world, SETTINGS_TITLE).at(-1)?.options).toEqual([...labels, DONE_LABEL])
  expect(world.pi.unexpected).toEqual([])
})

test("with no projects registered the projects line says so and opens nothing to pick", async () => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { projects: [] })
  const turn = await settingsScreen(world, [pickLine("Projects:"), leaveScreen])
  expect(turn.notifications.map((notice) => [notice.message, notice.notifyType])).toEqual([
    [NO_PROJECTS_NOTICE, "info"],
  ])
  expect(dialogsTitled(world, SETTINGS_TITLE)).toHaveLength(2)
  expect(world.pi.unexpected).toEqual([])
})
