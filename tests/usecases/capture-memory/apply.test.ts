import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { applyWrite, observeRead, updateMemory } from "#src/usecases"
import { captureFixture, noteWithId, putCatalogFile } from "#test-helpers"

const draft = { folder: "tools", statement: "Use pnpm", body: "Always pnpm.", type: "rule", dontForget: false } as const

test("an add saves the note and reports it applied with its path", async () => {
  const { context, vault } = await captureFixture()

  const applied = await applyWrite({ action: "add", vault: "global", note: draft }, context)

  expect(applied).toEqual({
    operation: "add",
    status: "applied",
    vault: "global",
    path: "tools/Use pnpm.md",
    detail: "Saved",
  })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toContain("Always pnpm.")
})

test("an add of a name that exists is refused with the reason", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Already.", []))

  const applied = await applyWrite({ action: "add", vault: "global", note: draft }, context)

  expect(applied).toMatchObject({ operation: "add", status: "refused", path: "tools/Use pnpm.md" })
  expect(applied.detail).not.toBe("")
})

test("an update, an archive and a succession of a note that was never read are refused, never conflicts", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const hash = "a".repeat(64)
  const id = "01JABCDE7XKQ2M9V3RTN8WPZ01"

  const update = await applyWrite(
    { action: "update", vault: "global", path: "tools/Use pnpm.md", id, expectedHash: hash, note: draft },
    context,
  )
  const archive = await applyWrite(
    { action: "archive", vault: "global", path: "tools/Use pnpm.md", id, expectedHash: hash },
    context,
  )
  const succeed = await applyWrite(
    { action: "succeed", vault: "global", path: "tools/Use pnpm.md", id, expectedHash: hash, note: draft },
    context,
  )

  expect([update, archive, succeed].map((entry) => [entry.operation, entry.status])).toEqual([
    ["update", "refused"],
    ["archive", "refused"],
    ["succeed", "refused"],
  ])
})

test("a change is a conflict when its hash is not the hash of the read it is based on", async () => {
  const { context, vault, read } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await read("global", "tools/Use pnpm.md")
  const before = await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")
  const id = "01JABCDE7XKQ2M9V3RTN8WPZ01"

  const applied = await applyWrite(
    { action: "update", vault: "global", path: "tools/Use pnpm.md", id, expectedHash: "b".repeat(64), note: draft },
    context,
  )

  expect(applied).toMatchObject({ operation: "update", status: "conflict" })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toBe(before)
})

test("a change is a conflict when its id is not the id of the note that was read", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const read = await observeRead({ vault: "global", path: "tools/Use pnpm.md" }, context)
  if (typeof read === "string") throw new Error(read)

  const applied = await applyWrite(
    {
      action: "archive",
      vault: "global",
      path: "tools/Use pnpm.md",
      id: "01JABCDE7XKQ2M9V3RTN8WPZ99",
      expectedHash: read.hash,
    },
    context,
  )

  expect(applied).toMatchObject({ operation: "archive", status: "conflict" })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toContain("Always pnpm.")
})

test("a read made by the main session does not let capture change the note", async () => {
  const { context, vault, read } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const delivered = await read("global", "tools/Use pnpm.md")
  if (!delivered.succeeded || delivered.output.kind !== "note") throw new Error("no read")
  const sibling = context.session.sibling({ sessionId: "s", branchId: "capture" })
  const capture = { ...context, session: sibling, stamp: sibling.stamp(), signal: sibling.signal(sibling.stamp()) }

  const applied = await applyWrite(
    {
      action: "update",
      vault: "global",
      path: "tools/Use pnpm.md",
      id: "01JABCDE7XKQ2M9V3RTN8WPZ01",
      expectedHash: delivered.output.file.rawHash,
      note: draft,
    },
    capture,
  )

  expect(applied).toMatchObject({ operation: "update", status: "refused", detail: expect.stringContaining("not read") })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toContain("Always pnpm.")
})

test("a read made by capture does not let the main session change the note", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  const sibling = context.session.sibling({ sessionId: "s", branchId: "capture" })
  const capture = { ...context, session: sibling, stamp: sibling.stamp(), signal: sibling.signal(sibling.stamp()) }
  await observeRead({ vault: "global", path: "tools/Use pnpm.md" }, capture)

  const result = await updateMemory({ vault: "global", path: "tools/Use pnpm.md", body: "Main's version." }, context)

  expect(result).toMatchObject({ succeeded: false, reason: "not-read" })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toContain("Always pnpm.")
})
