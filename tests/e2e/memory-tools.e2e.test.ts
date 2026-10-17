import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  callsOf,
  e2eWorld,
  endOf,
  fileExists,
  idOf,
  localToday,
  toolCallPrompt,
  toolText,
  ULID_LINE,
} from "#test-helpers"

const statement = "Use pnpm, never npm"
const notePath = `tools/${statement}.md`
const successor = "Use pnpm 10, never npm"

test("memory_add, memory_search, memory_get and memory_update change the global vault as the disk shows", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault } = world.folders
  const add = {
    scope: "global",
    folder: "tools",
    statement,
    type: "rule",
    body: "Every install and script runs with pnpm.",
    dontForget: false,
  }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(callsOf(added, "memory_add")).toBe(1)
  expect(endOf(added, "memory_add").isError).toBe(false)
  const text = await readFile(join(globalVault, notePath), "utf8")
  expect(text).toMatch(ULID_LINE)
  expect(text).toContain("type: rule")
  expect(text).toContain(`created: ${localToday()}`)
  expect(text).toContain("Every install and script runs with pnpm.")
  expect(await readFile(join(globalVault, "tools", "index.md"), "utf8")).toContain(statement)

  const search = { query: "pnpm", vault: "global" }
  const searched = await world.pi.prompt(toolCallPrompt("memory_search", JSON.stringify(search)), [])
  expect(callsOf(searched, "memory_search")).toBe(1)
  expect(toolText(endOf(searched, "memory_search"))).toContain(statement)

  const get = { vault: "global", path: notePath }
  const read = await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify(get)), [])
  expect(callsOf(read, "memory_get")).toBe(1)
  expect(toolText(endOf(read, "memory_get"))).toContain("Every install and script runs with pnpm.")

  const update = { vault: "global", path: notePath, body: "Every install, script and CI step runs with pnpm." }
  const updated = await world.pi.prompt(toolCallPrompt("memory_update", JSON.stringify(update)), [])
  expect(callsOf(updated, "memory_update")).toBe(1)
  expect(endOf(updated, "memory_update").isError).toBe(false)
  const changed = await readFile(join(globalVault, notePath), "utf8")
  expect(changed).toContain("Every install, script and CI step runs with pnpm.")
  expect(changed).not.toContain("Every install and script runs with pnpm.")
  expect(changed).toContain(`updated: ${localToday()}`)
})

test("memory_succeed archives the read note with a link to its successor", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { globalVault } = world.folders
  const add = {
    scope: "global",
    folder: "tools",
    statement,
    type: "rule",
    body: "Every install runs with pnpm.",
    dontForget: false,
  }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(callsOf(added, "memory_add")).toBe(1)
  expect(endOf(added, "memory_add").isError).toBe(false)
  const original = await readFile(join(globalVault, notePath), "utf8")
  const get = { vault: "global", path: notePath }
  const read = await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify(get)), [])
  expect(callsOf(read, "memory_get")).toBe(1)
  expect(endOf(read, "memory_get").isError).toBe(false)
  const succeed = {
    vault: "global",
    path: notePath,
    folder: "tools",
    statement: successor,
    type: "rule",
    body: "Every install runs with pnpm 10.",
    dontForget: false,
  }
  const succeeded = await world.pi.prompt(toolCallPrompt("memory_succeed", JSON.stringify(succeed)), [])
  expect(callsOf(succeeded, "memory_succeed")).toBe(1)
  expect(endOf(succeeded, "memory_succeed").isError).toBe(false)
  expect(await fileExists(join(globalVault, notePath))).toBe(false)
  const archived = await readFile(join(globalVault, "archive", notePath), "utf8")
  expect(archived).toContain(`archived: ${localToday()}`)
  expect(idOf(archived)).toBe(idOf(original))
  expect(archived).toContain("Every install runs with pnpm.")
  expect(archived).toContain(`replacedBy: "[[tools/${successor}]]"`)
  expect(await readFile(join(globalVault, "tools", `${successor}.md`), "utf8")).toContain(
    `replaces: "[[archive/tools/${statement}]]"`,
  )
})

test("memory_archive moves a read project note into the project vault's archive", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "at-session-end" })
  const { projectVault } = world.folders
  const add = {
    scope: "project",
    folder: "ci",
    statement: "CI runs on Jenkins",
    type: "fact",
    body: "Jenkins builds main.",
    dontForget: false,
  }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(callsOf(added, "memory_add")).toBe(1)
  expect(endOf(added, "memory_add").isError).toBe(false)
  const original = await readFile(join(projectVault, "ci", "CI runs on Jenkins.md"), "utf8")
  const note = { vault: "project", path: "ci/CI runs on Jenkins.md" }
  const read = await world.pi.prompt(toolCallPrompt("memory_get", JSON.stringify(note)), [])
  expect(callsOf(read, "memory_get")).toBe(1)
  expect(endOf(read, "memory_get").isError).toBe(false)
  const archived = await world.pi.prompt(toolCallPrompt("memory_archive", JSON.stringify(note)), [])
  expect(callsOf(archived, "memory_archive")).toBe(1)
  expect(endOf(archived, "memory_archive").isError).toBe(false)
  expect(await fileExists(join(projectVault, "ci", "CI runs on Jenkins.md"))).toBe(false)
  const archivedText = await readFile(join(projectVault, "archive", "ci", "CI runs on Jenkins.md"), "utf8")
  expect(archivedText).toContain(`archived: ${localToday()}`)
  expect(idOf(archivedText)).toBe(idOf(original))
  expect(archivedText).toContain("Jenkins builds main.")
})
