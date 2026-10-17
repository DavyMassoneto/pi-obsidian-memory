import { mkdir, rename, rm } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { MemoryBlock, MemorySessionKeeper } from "#src/pi"
import { LoadedMemory } from "#src/usecases"
import {
  fakePiContext,
  noteWithId,
  piMemoryFixture,
  piRegistrationFixture,
  promptEvent,
  putCatalogFile,
} from "#test-helpers"

test("the block is present with zero marked notes, says it is partial and names both read tools", async () => {
  const { pi, piContext, workingFolder } = await piMemoryFixture()
  await pi.startSession(piContext, "startup")

  const sections = await pi.runPrompt(workingFolder)

  const block = sections.obsidian_memory
  expect(block).toContain("only part of your long-term memory")
  expect(block).toContain("memory_search")
  expect(block).toContain("memory_get")
  expect(block).toContain("No note is marked Don't forget.")
  expect(block).not.toContain("memory_add")
})

test("a marked note of each vault is in the block in full", async () => {
  const { pi, piContext, workingFolder, vaults } = await piMemoryFixture()
  await putCatalogFile(vaults.global, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", ["dontForget: true"]))
  await putCatalogFile(vaults.project, "Deploy.md", noteWithId(2, "Deploy on Friday.", ["dontForget: true"]))
  await pi.startSession(piContext, "startup")

  const block = (await pi.runPrompt(workingFolder)).obsidian_memory

  expect(block).toContain("Don't forget notes:")
  expect(block).toContain("### global · tools/Use pnpm.md · rule\nAlways pnpm.")
  expect(block).toContain("### project · Deploy.md · rule\nDeploy on Friday.")
})

test("the block is set in every prompt, byte-identical, and is computed once per session start", async () => {
  const { pi, piContext, workingFolder, globalVault, vaults } = await piMemoryFixture()
  await putCatalogFile(vaults.global, "Keep.md", noteWithId(1, "Keep.", ["dontForget: true"]))
  await pi.startSession(piContext, "startup")
  const first = (await pi.runPrompt(workingFolder)).obsidian_memory
  await mkdir(join(globalVault, "archive"))
  await rename(join(globalVault, "Keep.md"), join(globalVault, "archive/Keep.md"))

  const second = (await pi.runPrompt(workingFolder)).obsidian_memory

  expect(first).toContain("Keep.")
  expect(second).toBe(first)
})

test("a note archived in Obsidian drops out of the block at the next session start", async () => {
  const { pi, piContext, workingFolder, globalVault, vaults } = await piMemoryFixture()
  await putCatalogFile(vaults.global, "Keep.md", noteWithId(1, "Keep.", ["dontForget: true"]))
  await pi.startSession(piContext, "startup")
  await mkdir(join(globalVault, "archive"))
  await rename(join(globalVault, "Keep.md"), join(globalVault, "archive/Keep.md"))

  await pi.startSession(piContext, "resume")

  const block = (await pi.runPrompt(workingFolder)).obsidian_memory
  expect(block).toContain("No note is marked Don't forget.")
})

test("without a config there is no block", async () => {
  const { pi, workingFolder } = await piRegistrationFixture()
  const { context } = fakePiContext(workingFolder, { hasUI: false })
  await pi.startSession(context, "startup")

  expect(await pi.runPrompt(workingFolder)).toEqual({})
})

test("a load that fails unexpectedly still gives a block that names the tools and the failure", async () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const operation = keeper.operationContext(
    keeper.start(context),
    "work",
    { configPath: "c", indexPath: "i" },
    undefined,
  )
  const told: string[] = []
  const block = new MemoryBlock(() => Promise.reject(new Error("disk exploded")))

  block.begin({
    ctx: context,
    context: operation,
    configured: true,
    loaded: new LoadedMemory(),
    relevant: async () => null,
    notify: (messages) => told.push(...messages),
  })
  const event = promptEvent("work")
  await block.beforeAgentStart()(event, context)

  const text = event.systemPromptOptions.sections.obsidian_memory
  expect(text).toContain("memory_search")
  expect(text).toContain("memory_get")
  expect(text).toContain("Could not load Don't forget notes: disk exploded")
  expect(told).toEqual(["Could not load Don't forget notes: disk exploded"])
})

test("a load that is refused still gives a block that names the tools and says why, and tells the user", async () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const operation = keeper.operationContext(
    keeper.start(context),
    "work",
    { configPath: "c", indexPath: "i" },
    undefined,
  )
  const told: string[] = []
  const block = new MemoryBlock(async () => ({
    succeeded: false,
    reason: "config-unavailable",
    configPath: "c",
    problems: ["no config"],
  }))

  block.begin({
    ctx: context,
    context: operation,
    configured: true,
    loaded: new LoadedMemory(),
    relevant: async () => null,
    notify: (messages) => told.push(...messages),
  })
  const event = promptEvent("work")
  await block.beforeAgentStart()(event, context)

  const text = event.systemPromptOptions.sections.obsidian_memory
  expect(text).toContain("memory_get")
  expect(text).toContain("Could not load Don't forget notes: no config")
  expect(told).toEqual(["Could not load Don't forget notes: no config"])
})

test("a vault that could not be read is told to the user too, while the other vault's notes are kept", async () => {
  const { pi, workingFolder, vaults, projectVault } = await piMemoryFixture()
  await putCatalogFile(vaults.global, "Keep.md", noteWithId(1, "Keep.", ["dontForget: true"]))
  await rm(projectVault, { recursive: true })
  const { context, notifications } = fakePiContext(workingFolder, { hasUI: true })

  await pi.startSession(context, "startup")
  const block = (await pi.runPrompt(workingFolder)).obsidian_memory

  expect(block).toContain("Keep.")
  expect(notifications.filter((item) => item.message.includes("project"))).toHaveLength(1)
})

test("a relevant-notes load that rejects is told to the user and does not take the Don't forget block down", async () => {
  const keeper = new MemorySessionKeeper()
  const { context } = fakePiContext("work", {})
  const operation = keeper.operationContext(
    keeper.start(context),
    "work",
    { configPath: "c", indexPath: "i" },
    undefined,
  )
  const told: string[] = []
  const block = new MemoryBlock(async () => ({ succeeded: true, output: { vaults: [] } }))

  block.begin({
    ctx: context,
    context: operation,
    configured: true,
    loaded: new LoadedMemory(),
    relevant: () => Promise.reject(new Error("agent exploded")),
    notify: (messages) => told.push(...messages),
  })
  const event = promptEvent("work")
  await block.beforeAgentStart()(event, context)

  expect(event.systemPromptOptions.sections.obsidian_memory).toContain("No note is marked Don't forget.")
  expect(told).toEqual(["Could not load relevant notes: agent exploded"])
})
