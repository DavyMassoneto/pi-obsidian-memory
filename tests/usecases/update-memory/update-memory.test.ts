import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { updateMemory } from "#src/usecases"
import { changeFixture, noteWithId, READIED_PATH as path, putCatalogFile, readiedNote } from "#test-helpers"

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
