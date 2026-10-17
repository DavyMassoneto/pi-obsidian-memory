import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { memoryIndexPath, memoryModelCachePath } from "#src/pi"
import {
  configText,
  E2E_PROJECT_NAME,
  e2eWorld,
  expectVaultRefusal,
  linkFolder,
  noteWithId,
  rewriteConfig,
  runAllowed,
  skillsPath,
  storedConfig,
  type WorldOptions,
  writeVaultFile,
} from "#test-helpers"

const configured: WorldOptions = { memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" }

test("the config file and the shipped skill can be read, and the config file written and edited", async () => {
  const world = await e2eWorld(configured)
  const { configPath } = world.folders
  const text = await configText(world)
  const skill = join(skillsPath(), "obsidian-memory", "SKILL.md")
  expect.soft(await runAllowed(world, { tool: "read", args: { path: configPath } })).toBe(text)
  expect.soft(await runAllowed(world, { tool: "read", args: { path: skill } })).toBe(await readFile(skill, "utf8"))
  await runAllowed(world, { tool: "write", args: { path: configPath, content: text } })
  expect.soft(await configText(world)).toBe(text)
  const name = JSON.stringify(E2E_PROJECT_NAME)
  const edits = [{ oldText: name, newText: JSON.stringify("e2e-renamed") }]
  await runAllowed(world, { tool: "edit", args: { path: configPath, edits } })
  expect.soft(await configText(world)).toBe(text.replace(name, JSON.stringify("e2e-renamed")))
})

test("with no config nothing is refused, so the LLM can write the config to start setup", async () => {
  const world = await e2eWorld({ ...configured, memory: "none" })
  await writeVaultFile(world.folders.globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const note = join(world.folders.globalVault, "tools", "Use pnpm.md")
  expect.soft(await runAllowed(world, { tool: "read", args: { path: note } })).toBe(await readFile(note, "utf8"))
  await runAllowed(world, { tool: "write", args: { path: world.folders.configPath, content: "{}" } })
  expect.soft(await readFile(world.folders.configPath, "utf8")).toBe("{}")
})

test("the config is read on every call: a vault registered later is refused at once", async () => {
  const world = await e2eWorld(configured)
  const later = join(world.folders.root, "later-vault")
  await mkdir(later)
  await writeFile(join(later, "Note.md"), "later-note-4417")
  const call = { tool: "read", args: { path: join(later, "Note.md") } }
  expect(await runAllowed(world, call)).toBe("later-note-4417")
  const config = await storedConfig(world)
  await rewriteConfig(world, { global: { ...config.global, vault: later } })
  await expectVaultRefusal(world, call)
  expect(await readFile(join(later, "Note.md"), "utf8")).toBe("later-note-4417")
})

test("a real junction into a vault is refused", async () => {
  const world = await e2eWorld(configured)
  const { globalVault, cwd } = world.folders
  await writeVaultFile(globalVault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await linkFolder(globalVault, join(cwd, "alias"))
  await expectVaultRefusal(world, { tool: "read", args: { path: join(cwd, "alias", "tools", "Use pnpm.md") } })
})

test.each([
  ["index folder", memoryIndexPath, "a.sqlite"],
  ["model cache", memoryModelCachePath, "probe.txt"],
] as const)("read, write and edit inside the %s are allowed", async (_name, folderOf, file) => {
  const world = await e2eWorld({ ...configured, modelCache: "fresh" })
  const path = join(folderOf(world.folders.agentDir), file)
  await runAllowed(world, { tool: "write", args: { path, content: "probe-1" } })
  await expect.soft(readFile(path, "utf8")).resolves.toBe("probe-1")
  expect.soft(await runAllowed(world, { tool: "read", args: { path } })).toBe("probe-1")
  await runAllowed(world, { tool: "edit", args: { path, edits: [{ oldText: "probe-1", newText: "probe-2" }] } })
  await expect.soft(readFile(path, "utf8")).resolves.toBe("probe-2")
})
