import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { resolveFile, resolveFolder } from "#/services"
import { linkFolder, otherDriveRoots, tryLinkFile, useTempVault } from "#test-helpers"

test("resolves a file inside the vault, even in folders that do not exist yet", async () => {
  const vault = await useTempVault()

  expect(await resolveFile(vault, "tools/pnpm", "Rule.md")).toEqual({
    succeeded: true,
    output: join(vault, "tools", "pnpm", "Rule.md"),
  })
})

test("resolves the vault root as a folder", async () => {
  const vault = await useTempVault()

  expect(await resolveFolder(vault, "")).toEqual({ succeeded: true, output: join(vault) })
})

test("refuses an invalid folder or file name with every problem", async () => {
  const vault = await useTempVault()

  expect(await resolveFile(vault, "../other", "sub/Rule.md")).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ['folder: ".." is not allowed', 'file name "sub/Rule.md": "/" is not allowed in a file name'],
  })
  expect(await resolveFolder(vault, "C:/other")).toEqual({
    succeeded: false,
    reason: "invalid",
    problems: ["folder: must be relative to the vault"],
  })
})

test("refuses a vault folder that does not exist, creating nothing", async () => {
  const root = await useTempVault()
  const vault = join(root, "missing")

  expect(await resolveFile(vault, "pnpm", "Rule.md")).toEqual({
    succeeded: false,
    reason: "vault-missing",
    problems: [`the vault folder ${vault} does not exist`],
  })
})

test("refuses a folder link that leads outside the vault", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await linkFolder(outside, join(vault, "escape"))

  expect(await resolveFile(vault, "escape/pnpm", "Rule.md")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["escape leads outside the vault"],
  })
})

test("refuses a link to a sibling folder whose name starts with the vault name", async () => {
  const vault = await useTempVault()
  const sibling = `${vault}-other`
  await mkdir(sibling)
  await linkFolder(sibling, join(vault, "tools"))

  try {
    expect(await resolveFolder(vault, "tools")).toMatchObject({ succeeded: false, reason: "outside-vault" })
  } finally {
    await rm(sibling, { recursive: true, force: true })
  }
})

test("refuses a link to the folder that holds the vault", async () => {
  const root = await useTempVault()
  const vault = join(root, "vault")
  await mkdir(vault)
  await linkFolder(root, join(vault, "up"))

  expect(await resolveFolder(vault, "up")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["up leads outside the vault"],
  })
})

test("refuses a link to another drive", async (context) => {
  const vault = await useTempVault()
  const [driveRoot] = otherDriveRoots()
  if (!driveRoot) {
    context.skip("this system has a single drive")
    return
  }
  await linkFolder(driveRoot, join(vault, "drive"))

  expect(await resolveFolder(vault, "drive")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["drive leads outside the vault"],
  })
})

test("refuses a link that does not resolve", async () => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  const gone = join(outside, "gone")
  await mkdir(gone)
  await linkFolder(gone, join(vault, "tools"))
  await rm(gone, { recursive: true })

  expect(await resolveFile(vault, "tools", "Rule.md")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["tools is a link that does not resolve"],
  })
})

test("refuses a link to itself", async () => {
  const vault = await useTempVault()
  await linkFolder(join(vault, "self"), join(vault, "self"))

  expect(await resolveFile(vault, "self", "Rule.md")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["self is a link that does not resolve"],
  })
})

test("refuses two links that point at each other", async () => {
  const vault = await useTempVault()
  await linkFolder(join(vault, "b"), join(vault, "a"))
  await linkFolder(join(vault, "a"), join(vault, "b"))

  expect(await resolveFile(vault, "a", "Rule.md")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["a is a link that does not resolve"],
  })
})

test("does not take a vault that is a link loop for a missing vault", async () => {
  const root = await useTempVault()
  const vault = join(root, "vault")
  await linkFolder(vault, vault)

  await expect(resolveFolder(vault, "pnpm")).rejects.toMatchObject({ code: "ELOOP" })
})

test("accepts a folder link that stays inside the vault", async () => {
  const vault = await useTempVault()
  await mkdir(join(vault, "real"))
  await linkFolder(join(vault, "real"), join(vault, "alias"))

  expect(await resolveFile(vault, "alias", "Rule.md")).toEqual({
    succeeded: true,
    output: join(vault, "alias", "Rule.md"),
  })
})

test("accepts a vault reached through a link", async () => {
  const root = await useTempVault()
  await mkdir(join(root, "real vault"))
  await linkFolder(join(root, "real vault"), join(root, "vault"))

  expect(await resolveFolder(join(root, "vault"), "pnpm")).toMatchObject({ succeeded: true })
})

test("refuses a file link that leads outside the vault", async (context) => {
  const vault = await useTempVault()
  const outside = await useTempVault()
  await writeFile(join(outside, "secret.md"), "outside")
  await mkdir(join(vault, "pnpm"))
  const linked = await tryLinkFile(join(outside, "secret.md"), join(vault, "pnpm", "Rule.md"))
  if (!linked) {
    context.skip("this system cannot create file links")
  }

  expect(await resolveFile(vault, "pnpm", "Rule.md")).toEqual({
    succeeded: false,
    reason: "outside-vault",
    problems: ["pnpm/Rule.md leads outside the vault"],
  })
})
