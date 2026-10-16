import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { afterEach, expect, test, vi } from "vitest"

import { updateMemory } from "#src/usecases"
import {
  changeFixture,
  expectRegistrationLeaseReleased,
  noteWithId,
  READIED_PATH as path,
  putCatalogFile,
  readiedNote,
} from "#test-helpers"

afterEach(() => {
  vi.useRealTimers()
})

test("after a read the body changes, the id and created are kept and updated is today", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(2026, 9, 20, 10, 0))
  const { context, file, vault } = await readiedNote("Always pnpm.", [])

  const result = await updateMemory({ vault: "global", path, body: "Always pnpm, in CI too." }, context)

  expect(result).toMatchObject({ succeeded: true, output: { vault: "global", path, maintenanceProblems: [] } })
  const text = await readFile(file, "utf8")
  expect(text).toContain("id: 01JABCDE7XKQ2M9V3RTN8WPZ01")
  expect(text).toContain("created: 2026-10-04")
  expect(text).toContain("updated: 2026-10-20")
  expect(text).toContain("type: rule")
  expect(text).toContain("Always pnpm, in CI too.")
  expect(await readFile(join(vault.path, "tools", "index.md"), "utf8")).toContain("Use pnpm")
  await expectRegistrationLeaseReleased(context)
})

test("type and dontForget change when given and stay when omitted", async () => {
  const { context, file, read } = await readiedNote("Always pnpm.", ["dontForget: true"])

  await updateMemory({ vault: "global", path, body: "Kept marks." }, context)
  expect(await readFile(file, "utf8")).toContain("dontForget: true")
  expect(await readFile(file, "utf8")).toContain("type: rule")

  await read("global", path)
  const second = await updateMemory(
    { vault: "global", path, body: "New marks.", type: "fact", dontForget: false },
    context,
  )

  expect(second.succeeded).toBe(true)
  const text = await readFile(file, "utf8")
  expect(text).toContain("type: fact")
  expect(text).not.toContain("dontForget")
})

test("a note edited between the read and the update is a conflict and the edit stays", async () => {
  const { context, vault, file } = await readiedNote("Always pnpm.", [])
  await putCatalogFile(vault, path, noteWithId(1, "The user edited this.", []))
  const edited = await readFile(file, "utf8")

  const result = await updateMemory({ vault: "global", path, body: "Mine." }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "conflict" })
  expect(await readFile(file, "utf8")).toBe(edited)
})

test("an invalid update is refused and writes nothing", async () => {
  const { context, file } = await readiedNote("Always pnpm.", [])
  const before = await readFile(file, "utf8")

  const result = await updateMemory({ vault: "global", path, body: "" }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "invalid" })
  expect(await readFile(file, "utf8")).toBe(before)
})

test("the project vault is updated independently of the global one", async () => {
  const { context, project, read } = await changeFixture()
  await putCatalogFile(project, "Deploy.md", noteWithId(3, "Deploy on Friday.", []))
  await read("project", "Deploy.md")

  const result = await updateMemory({ vault: "project", path: "Deploy.md", body: "Deploy on Monday." }, context)

  expect(result.succeeded).toBe(true)
  expect(await readFile(join(project.path, "Deploy.md"), "utf8")).toContain("Deploy on Monday.")
})
