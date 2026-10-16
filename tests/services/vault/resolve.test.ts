import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { renderNote } from "#/domain"
import { createMemoryNote, listFolder, readNote } from "#/services"
import { aLimits, aNote, linkFolder, otherDriveRoots, tryLinkFile, useTempFolder } from "#test-helpers"

test("creates missing folders under the resolved vault", async () => {
  const vault = await useTempFolder()
  const note = aNote()

  expect(await createMemoryNote({ path: vault, limits: aLimits() }, "tools/pnpm", note)).toMatchObject({
    succeeded: true,
  })
  expect(await readFile(join(vault, "tools", "pnpm", `${note.statement}.md`), "utf8")).toBe(renderNote(note))
})

test("refuses invalid folder and file names before reading", async () => {
  const vault = await useTempFolder()

  expect(await readNote({ path: vault, limits: aLimits() }, "../other", "sub/Rule")).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder: ".." is not allowed', 'file name "sub/Rule.md": "/" is not allowed in a file name'],
  })
  expect(await listFolder({ path: vault, limits: aLimits() }, "C:/other")).toMatchObject({ reason: "invalid" })
})

test("refuses a missing vault", async () => {
  const root = await useTempFolder()

  expect(await readNote({ path: join(root, "missing"), limits: aLimits() }, "", "Rule")).toMatchObject({
    reason: "vault-missing",
  })
})

test("refuses a file configured as a vault without modifying it", async () => {
  const root = await useTempFolder()
  const vault = join(root, "file")
  await writeFile(vault, "user file")

  expect(await listFolder({ path: vault, limits: aLimits() }, "")).toMatchObject({ reason: "not-directory" })
  expect(await readFile(vault, "utf8")).toBe("user file")
})

test("refuses a folder link leading outside", async () => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await linkFolder(outside, join(vault, "escape"))

  expect(await readNote({ path: vault, limits: aLimits() }, "escape/pnpm", "Rule")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test("refuses a sibling whose name starts with the vault name", async () => {
  const vault = await useTempFolder()
  const sibling = `${vault}-other`
  await mkdir(sibling)
  await linkFolder(sibling, join(vault, "tools"))
  try {
    expect(await listFolder({ path: vault, limits: aLimits() }, "tools")).toMatchObject({ reason: "outside-vault" })
  } finally {
    await rm(sibling, { recursive: true })
  }
})

test("refuses a link to the parent folder", async () => {
  const root = await useTempFolder()
  const vault = join(root, "vault")
  await mkdir(vault)
  await linkFolder(root, join(vault, "up"))

  expect(await listFolder({ path: vault, limits: aLimits() }, "up")).toMatchObject({ reason: "outside-vault" })
})

test("refuses a link to another drive", async (context) => {
  const vault = await useTempFolder()
  const [drive] = otherDriveRoots()
  if (!drive) {
    context.skip("this system has a single drive")
    return
  }
  await linkFolder(drive, join(vault, "drive"))

  expect(await listFolder({ path: vault, limits: aLimits() }, "drive")).toMatchObject({ reason: "outside-vault" })
})

test("refuses a broken folder link", async () => {
  const vault = await useTempFolder()
  const target = join(vault, "gone")
  await mkdir(target)
  await linkFolder(target, join(vault, "alias"))
  await rm(target, { recursive: true })

  expect(await readNote({ path: vault, limits: aLimits() }, "alias", "Rule")).toMatchObject({
    reason: "outside-vault",
    problems: ["alias is a link that does not resolve"],
  })
})

test.each(["self", "pair"])("refuses a %s link loop", async (kind) => {
  const vault = await useTempFolder()
  if (kind === "self") {
    await linkFolder(join(vault, "a"), join(vault, "a"))
  } else {
    await linkFolder(join(vault, "b"), join(vault, "a"))
    await linkFolder(join(vault, "a"), join(vault, "b"))
  }

  expect(await listFolder({ path: vault, limits: aLimits() }, "a")).toMatchObject({ reason: "outside-vault" })
})

test("preserves a permitted folder alias while writing to its target", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "real"))
  await linkFolder(join(vault, "real"), join(vault, "alias"))

  expect(await createMemoryNote({ path: vault, limits: aLimits() }, "alias/deep", aNote())).toMatchObject({
    succeeded: true,
  })
  expect(await readFile(join(vault, "real", "deep", `${aNote().statement}.md`), "utf8")).toBe(renderNote(aNote()))
})

test("accepts a vault reached through a link", async () => {
  const root = await useTempFolder()
  await mkdir(join(root, "real"))
  await linkFolder(join(root, "real"), join(root, "vault"))

  expect(await createMemoryNote({ path: join(root, "vault"), limits: aLimits() }, "", aNote())).toMatchObject({
    succeeded: true,
  })
  expect(await readFile(join(root, "real", `${aNote().statement}.md`), "utf8")).toBe(renderNote(aNote()))
})

test("refuses an external file link", async (context) => {
  const vault = await useTempFolder()
  const outside = await useTempFolder()
  await writeFile(join(outside, "secret.md"), "outside")
  if (!(await tryLinkFile(join(outside, "secret.md"), join(vault, "Rule.md")))) {
    context.skip("this system cannot create file links")
    return
  }

  expect(await readNote({ path: vault, limits: aLimits() }, "", "Rule")).toMatchObject({ reason: "outside-vault" })
})
