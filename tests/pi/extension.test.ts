import { expect, test } from "vitest"

import * as pi from "#src/pi"
import { respondTo, respondToGet, respondToSearch } from "#src/pi"
import type { AddMemoryResult } from "#src/usecases"
import {
  aNote,
  blockTexts,
  changeTexts,
  getResponses,
  mentionsIn,
  PI_BUILTIN_COMMANDS,
  piMemoryFixture,
  registerWithFakePi,
  relevantTexts,
  searchResponses,
  semanticTexts,
  shippedSkillText,
  textOf,
  unregisteredMentions,
  vaultRefusalText,
} from "#test-helpers"

test("registers the six tools, the four commands and the session events", () => {
  const { tools, searchTools, getTools, updateTools, archiveTools, succeedTools, registered, events, commands } =
    registerWithFakePi({})

  expect(tools).toEqual([
    expect.objectContaining({
      name: "memory_add",
      description: "Use only when the user explicitly asks to remember something.",
    }),
  ])
  expect(searchTools).toEqual([
    expect.objectContaining({
      name: "memory_search",
      description:
        "Search long-term memory by words. Archived notes and notes without valid frontmatter are not searched.",
    }),
  ])
  expect(getTools).toEqual([expect.objectContaining({ name: "memory_get" })])
  expect(updateTools).toEqual([
    expect.objectContaining({
      name: "memory_update",
      description: "Use only when the user explicitly asks to change a memory. Read it with memory_get first.",
    }),
  ])
  expect(archiveTools).toEqual([
    expect.objectContaining({
      name: "memory_archive",
      description:
        "Use only when the user explicitly asks to retire a memory with no successor. Read it with memory_get first.",
    }),
  ])
  expect(succeedTools).toEqual([
    expect.objectContaining({
      name: "memory_succeed",
      description:
        "Use only when the user explicitly asks to replace a memory that stopped being true or was resolved. Read it with memory_get first.",
    }),
  ])
  expect(registered).toEqual([
    "memory_add",
    "memory_search",
    "memory_get",
    "memory_update",
    "memory_archive",
    "memory_succeed",
  ])
  expect(events).toEqual([
    "session_start",
    "before_agent_start",
    "before_agent_start",
    "tool_call",
    "agent_end",
    "session_before_compact",
    "session_shutdown",
  ])
  expect(commands).toEqual(["memory-setup", "memory-init", "memory-export", "memory-doctor"])
})

test("shutting the session down drops the memory block", async () => {
  const { pi, piContext, workingFolder } = await piMemoryFixture()
  await pi.startSession(piContext, "startup")
  expect(Object.keys(await pi.runPrompt(workingFolder))).toEqual(["obsidian_memory"])

  await pi.shutdownSession(piContext)

  expect(await pi.runPrompt(workingFolder)).toEqual({})
})

test("turns off Claude Code's own memory in pi's environment", () => {
  const env: NodeJS.ProcessEnv = {}

  registerWithFakePi(env)

  expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe("1")
})

test("no LLM-facing text names a command or tool that is not registered", async () => {
  const { tools, searchTools, getTools, updateTools, archiveTools, succeedTools, registered, commands } =
    registerWithFakePi({})
  const problems = ["a problem"]
  const existing = { note: aNote(), hash: "hash" }
  const responses: AddMemoryResult[] = [
    {
      succeeded: true,
      output: {
        scope: "global",
        vaultName: "Global memory",
        folder: "tools",
        notePath: "tools/Use pnpm.md",
        stored: existing,
        maintenanceProblems: problems,
      },
    },
    { succeeded: false, reason: "exists", problems, existing },
    { succeeded: false, reason: "exists", problems, existingStatement: "Use pnpm" },
    { succeeded: false, reason: "invalid", problems },
    { succeeded: false, reason: "no-project", problems, workingFolder: "work", configPath: "config.json" },
    { succeeded: false, reason: "not-configured", problems, configPath: "config.json" },
    { succeeded: false, reason: "invalid-config", problems, configPath: "config.json" },
    { succeeded: false, reason: "unreadable", problems, configPath: "config.json" },
    { succeeded: false, reason: "not-directory", problems },
    { succeeded: false, reason: "not-readable", problems },
    { succeeded: false, reason: "not-writable", problems },
    { succeeded: false, reason: "outside-vault", problems },
    { succeeded: false, reason: "vault-missing", problems },
    { succeeded: false, reason: "not-found", problems },
  ]
  const constantTexts = Object.values(pi).filter(
    (value) =>
      typeof value === "string" &&
      value !== pi.MEMORY_BLOCK_SECTION &&
      value !== pi.CURSOR_TYPE &&
      value !== pi.RELEVANT_MESSAGE_TYPE,
  )
  const texts = [
    ...[...tools, ...searchTools, ...getTools, ...updateTools, ...archiveTools, ...succeedTools].map((tool) =>
      JSON.stringify(tool),
    ),
    ...changeTexts(),
    ...semanticTexts(),
    ...searchResponses().map((result) => textOf(respondToSearch(result))),
    ...getResponses().map((result) => textOf(respondToGet({ vault: "global", path: "p" }, result))),
    ...blockTexts(),
    ...relevantTexts(),
    shippedSkillText(),
    await vaultRefusalText(),
    ...responses.map((r) => textOf(respondTo(r))),
    ...constantTexts,
  ]
  const names = [...registered, ...commands, ...commands.map((name) => `/${name}`), ...PI_BUILTIN_COMMANDS]

  expect(mentionsIn(texts).length).toBeGreaterThan(0)
  expect(unregisteredMentions(texts, names)).toEqual([])
})

test("backticked and parenthesised mentions are caught too", () => {
  const registered = ["memory_add", "/memory-setup"]

  expect(unregisteredMentions(["Run `/memory-setup`, then `memory_add`."], registered)).toEqual([])
  expect(unregisteredMentions(["Run `/memory-doktor` (or (/memory-init)) or `memory_updat`."], registered)).toEqual([
    "/memory-doktor",
    "/memory-init",
    "memory_updat",
  ])
})

test("a registered slash command mention is accepted and an unregistered one is reported", () => {
  const registered = ["memory_add", "/memory-setup"]

  expect(unregisteredMentions(["Run /memory-setup, then memory_add."], registered)).toEqual([])
  expect(unregisteredMentions(["Run /memory-init or memory_update."], registered)).toEqual([
    "/memory-init",
    "memory_update",
  ])
})
