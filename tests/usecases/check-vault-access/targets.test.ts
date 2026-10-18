import { mkdir, realpath } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { guardedTargets } from "#src/usecases"
import { adminShareForm, devicePathForm, guardFixture, linkFolder, targetHits, volumeGuidForm } from "#test-helpers"

const onWindows = process.platform === "win32"
const missingVolume = String.raw`\\?\Volume{00000000-0000-0000-0000-000000000000}\Users\nobody\Note.md`

test("the targets hold each written path and its real location, and the identity of those that exist", async () => {
  const { vault, root } = await guardFixture()
  const alias = join(root, "vault-alias")
  await linkFolder(vault.path, alias)

  const targets = await guardedTargets([alias, join(root, "missing-vault")])

  expect(targets.roots).toEqual(
    expect.arrayContaining([alias, join(root, "missing-vault"), await realpath(vault.path)]),
  )
  expect(targets.identities).toHaveLength(1)
})

test("a path inside a target is hit as written and one outside it is not", async () => {
  const { vault, root, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(vault.path, "tools", "Note.md") })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "file", path: join(root, "elsewhere.txt") })).toBe(false)
})

test("a real junction into a target is hit for files, trees and listings", async () => {
  const { vault, root, cwd } = await guardFixture()
  await mkdir(join(vault.path, "tools"))
  const alias = join(root, "alias")
  await linkFolder(vault.path, alias)
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(alias, "tools", "Use pnpm.md") })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "tree", path: alias })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "listing", path: join(alias, "tools") })).toBe(true)
})

test("a target registered through a junction is also hit by its real location", async () => {
  const { root, cwd } = await guardFixture()
  const real = join(root, "real-vault")
  await mkdir(real)
  const alias = join(root, "vault-alias")
  await linkFolder(real, alias)
  const targets = await guardedTargets([alias])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(real, "Note.md") })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "file", path: join(alias, "Note.md") })).toBe(true)
})

test("a path that cannot be canonicalized is decided by its written form", async () => {
  const { vault, root, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(vault.path, "bad\0name.md") })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "file", path: join(root, "bad\0name.md") })).toBe(false)
})

test.runIf(onWindows)(
  "the machine's own admin share and a device path reach a target, and a path elsewhere stays outside",
  async () => {
    const { vault, root, cwd } = await guardFixture()
    const targets = await guardedTargets([vault.path])
    const note = join(vault.path, "tools", "Note.md")

    expect(await targetHits(targets, cwd, { kind: "file", path: adminShareForm(note) })).toBe(true)
    expect(await targetHits(targets, cwd, { kind: "tree", path: adminShareForm(vault.path) })).toBe(true)
    expect(await targetHits(targets, cwd, { kind: "file", path: devicePathForm(note) })).toBe(true)
    expect(await targetHits(targets, cwd, { kind: "file", path: adminShareForm(join(root, "elsewhere.txt")) })).toBe(
      false,
    )
  },
)

test("a folder is reached through a junction as well as written out", async () => {
  const { dataFolder, root, cwd } = await guardFixture()
  const alias = join(root, "machine-alias")
  await linkFolder(dataFolder, alias)
  const targets = await guardedTargets([dataFolder])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(alias, "config.json") })).toBe(true)
})

test.runIf(onWindows)("a folder is reached through an admin share as well as written out", async () => {
  const { dataFolder, cwd } = await guardFixture()
  const targets = await guardedTargets([dataFolder])

  expect(await targetHits(targets, cwd, { kind: "file", path: adminShareForm(join(dataFolder, "config.json")) })).toBe(
    true,
  )
})

test.runIf(onWindows)("a path through the real volume GUID reaches a target", async () => {
  const { vault, dataFolder, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path, dataFolder])

  expect(await targetHits(targets, cwd, { kind: "file", path: volumeGuidForm(join(vault.path, "Note.md")) })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "file", path: volumeGuidForm(join(dataFolder, "config.json")) })).toBe(
    true,
  )
})

test("a namespace path whose identity cannot be read is hit, since it cannot be shown to be outside", async () => {
  const { vault, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "file", path: missingVolume })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "tree", path: missingVolume })).toBe(true)
})

test("a missing plain path outside the targets is not hit", async () => {
  const { vault, root, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "file", path: join(root, "nope", "missing.txt") })).toBe(false)
})

test("a command is judged by the paths it writes out, never by canonical forms", async () => {
  const { vault, cwd } = await guardFixture()
  const targets = await guardedTargets([vault.path])

  expect(await targetHits(targets, cwd, { kind: "command", command: `cat "${vault.path}/Note.md"` })).toBe(true)
  expect(await targetHits(targets, cwd, { kind: "command", command: "git status" })).toBe(false)
})
