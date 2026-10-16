import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { CONFIG_PROTECTED_REFUSAL } from "#src/pi"
import {
  fakePiContext,
  linkFolder,
  piMemoryFixture,
  piUnconfiguredFixture,
  toolCallEvent,
  writeAgentConfig,
} from "#test-helpers"

const REFUSAL =
  "Vault files are reachable only through memory_search and memory_get, never with file tools or the shell."

test.each([
  ["read", "path"],
  ["write", "path"],
  ["edit", "path"],
  ["grep", "path"],
  ["find", "path"],
  ["ls", "path"],
] as const)("%s on a vault path is blocked with the refusal and allowed outside the vaults", async (tool, field) => {
  const { pi, piContext, vaults, root } = await piMemoryFixture()

  const blocked = await pi.runToolCall(
    toolCallEvent(tool, { [field]: join(vaults.global.path, "tools", "Note.md") }),
    piContext,
  )
  const project = await pi.runToolCall(
    toolCallEvent(tool, { [field]: join(vaults.project.path, "Note.md") }),
    piContext,
  )
  const allowed = await pi.runToolCall(toolCallEvent(tool, { [field]: join(root, "outside", "file.txt") }), piContext)

  expect(blocked).toEqual({ block: true, reason: REFUSAL })
  expect(project).toEqual({ block: true, reason: REFUSAL })
  expect(allowed).toBeUndefined()
})

test.each(["bash", "powershell"])(
  "%s with a vault path in the command is blocked and a plain command is allowed",
  async (tool) => {
    const { pi, piContext, vaults } = await piMemoryFixture()

    const blocked = await pi.runToolCall(
      toolCallEvent(tool, { command: `cat "${vaults.global.path}/Note.md"` }),
      piContext,
    )
    const allowed = await pi.runToolCall(toolCallEvent(tool, { command: "git status" }), piContext)

    expect(blocked).toEqual({ block: true, reason: REFUSAL })
    expect(allowed).toBeUndefined()
  },
)

test("a search or listing with no path uses the working folder", async () => {
  const { pi, vaults } = await piMemoryFixture()
  const { context } = fakePiContext(vaults.global.path, { hasUI: false })

  for (const tool of ["grep", "find", "ls"]) {
    expect(await pi.runToolCall(toolCallEvent(tool, {}), context)).toEqual({ block: true, reason: REFUSAL })
  }
})

test("a tool the guard does not know passes even with a vault path", async () => {
  const { pi, piContext, vaults } = await piMemoryFixture()

  expect(await pi.runToolCall(toolCallEvent("other_tool", { path: vaults.global.path }), piContext)).toBeUndefined()
})

test("a real junction into a vault is blocked", async () => {
  const { pi, piContext, vaults, root } = await piMemoryFixture()
  const alias = join(root, "alias")
  await linkFolder(vaults.global.path, alias)

  const result = await pi.runToolCall(toolCallEvent("read", { path: join(alias, "Note.md") }), piContext)

  expect(result).toEqual({ block: true, reason: REFUSAL })
})

test("the config file and the shipped skill stay readable", async () => {
  const { pi, piContext, configPath } = await piMemoryFixture()
  const skill = join(process.cwd(), "skills", "obsidian-memory", "SKILL.md")

  expect(await pi.runToolCall(toolCallEvent("read", { path: configPath }), piContext)).toBeUndefined()
  expect(await pi.runToolCall(toolCallEvent("read", { path: skill }), piContext)).toBeUndefined()
})

test("with no config nothing is blocked", async () => {
  const { pi, piContext, globalVault } = await piUnconfiguredFixture()

  expect(await pi.runToolCall(toolCallEvent("read", { path: join(globalVault, "Note.md") }), piContext)).toBeUndefined()
})

test("the config is read on every call, with no session start needed", async () => {
  const { pi, piContext, configPath, config, root } = await piMemoryFixture()
  const later = join(root, "later")
  const event = toolCallEvent("read", { path: join(later, "Note.md") })
  expect(await pi.runToolCall(event, piContext)).toBeUndefined()

  await writeAgentConfig(configPath, JSON.stringify({ ...config, global: { vault: later } }))

  expect(await pi.runToolCall(event, piContext)).toEqual({ block: true, reason: REFUSAL })
})

test.each([
  ["find", "pattern"],
  ["grep", "glob"],
] as const)("%s with a vault in the %s prefix is blocked, wherever the search starts", async (tool, field) => {
  const { pi, piContext, vaults, root } = await piMemoryFixture()
  const search = { pattern: "x" }
  const outside = join(root, "outside")

  const absolute = await pi.runToolCall(
    toolCallEvent(tool, { ...search, [field]: `${vaults.global.path}/**/*.md` }),
    piContext,
  )
  const upward = await pi.runToolCall(
    toolCallEvent(tool, { ...search, [field]: "../../Global memory/*.md" }),
    piContext,
  )
  const fromRoot = await pi.runToolCall(
    toolCallEvent(tool, { ...search, path: outside, [field]: "../Global memory/*.md" }),
    piContext,
  )

  expect(absolute).toEqual({ block: true, reason: REFUSAL })
  expect(upward).toEqual({ block: true, reason: REFUSAL })
  expect(fromRoot).toEqual({ block: true, reason: REFUSAL })
})

test.each([
  ["find", "pattern"],
  ["grep", "glob"],
] as const)("%s with a home-relative %s prefix into a vault is blocked", async (tool, field) => {
  const { pi, piContext, configPath, config } = await piMemoryFixture()
  const vault = join(homedir(), "pi-memory-guard-test-vault")
  await writeAgentConfig(configPath, JSON.stringify({ ...config, global: { vault } }))
  const search = { pattern: "x" }

  const result = await pi.runToolCall(
    toolCallEvent(tool, { ...search, [field]: "~/pi-memory-guard-test-vault/**" }),
    piContext,
  )

  expect(result).toEqual({ block: true, reason: REFUSAL })
})

test.each([
  ["find", "pattern"],
  ["grep", "glob"],
] as const)(
  "%s with a plain, relative or outside %s is allowed, and a grep pattern is not a path",
  async (tool, field) => {
    const { pi, piContext, vaults, root } = await piMemoryFixture()
    const search = { pattern: "x" }

    for (const glob of ["*.ts", "**/*.md", "src/**/*.ts", `${root}/outside/**/*.md`, "../sibling/*.md"]) {
      expect(await pi.runToolCall(toolCallEvent(tool, { ...search, [field]: glob }), piContext)).toBeUndefined()
    }
    expect(await pi.runToolCall(toolCallEvent("grep", { pattern: vaults.global.path }), piContext)).toBeUndefined()
  },
)

test.each(["write", "edit"])(
  "%s on the config file is blocked with the registration guidance, read is allowed",
  async (tool) => {
    const { pi, piContext, configPath } = await piMemoryFixture()

    const blocked = await pi.runToolCall(toolCallEvent(tool, { path: configPath }), piContext)
    const read = await pi.runToolCall(toolCallEvent("read", { path: configPath }), piContext)

    expect(blocked).toEqual({ block: true, reason: CONFIG_PROTECTED_REFUSAL })
    expect(read).toBeUndefined()
  },
)

test.each(["bash", "powershell"])(
  "%s that mentions the config path is blocked with the registration guidance",
  async (tool) => {
    const { pi, piContext, configPath } = await piMemoryFixture()

    const result = await pi.runToolCall(toolCallEvent(tool, { command: `echo {} > "${configPath}"` }), piContext)

    expect(result).toEqual({ block: true, reason: CONFIG_PROTECTED_REFUSAL })
  },
)

test("the config stays protected with no config, so a first write cannot register a vault", async () => {
  const { pi, piContext, configPath } = await piUnconfiguredFixture()

  const result = await pi.runToolCall(toolCallEvent("write", { path: configPath }), piContext)

  expect(result).toEqual({ block: true, reason: CONFIG_PROTECTED_REFUSAL })
})

test.each(["write", "edit"])("%s inside the memory data folder, the index included, is blocked", async (tool) => {
  const { pi, piContext, configPath } = await piMemoryFixture()

  const result = await pi.runToolCall(
    toolCallEvent(tool, { path: join(dirname(configPath), "index", "a.sqlite") }),
    piContext,
  )

  expect(result).toEqual({ block: true, reason: CONFIG_PROTECTED_REFUSAL })
})

test.each(["bash", "powershell"])("%s that removes the memory data folder is blocked", async (tool) => {
  const { pi, piContext, configPath } = await piMemoryFixture()

  const result = await pi.runToolCall(toolCallEvent(tool, { command: `rm -rf "${dirname(configPath)}"` }), piContext)

  expect(result).toEqual({ block: true, reason: CONFIG_PROTECTED_REFUSAL })
})
