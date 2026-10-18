import { mkdir, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { expect, test } from "vitest"

import { VAULT_ACCESS_REFUSAL } from "#src/services"
import { checkVaultAccess } from "#src/usecases"
import { guardFixture, testPlatform, useTempFolder, writeRegistrationSnapshot } from "#test-helpers"

const refused = { succeeded: false, reason: "vault-access", problems: [VAULT_ACCESS_REFUSAL] }

test("a file inside the global or the project vault is refused, outside any vault it is allowed", async () => {
  const { vault, project, check, root } = await guardFixture()

  expect(await check({ kind: "file", path: join(vault.path, "tools", "Use pnpm.md") })).toEqual(refused)
  expect(await check({ kind: "file", path: join(project.path, "Deploy.md") })).toEqual(refused)
  expect(await check({ kind: "file", path: join(root, "elsewhere.txt") })).toEqual({ succeeded: true })
})

test("a path relative to the working folder that reaches a vault is refused", async () => {
  const { check } = await guardFixture()

  expect(await check({ kind: "file", path: join("..", "global", "Note.md") })).toEqual(refused)
})

test("a tree search from a folder above a vault is refused and a listing of it is allowed", async () => {
  const { root, check } = await guardFixture()

  expect(await check({ kind: "tree", path: root })).toEqual(refused)
  expect(await check({ kind: "listing", path: root })).toEqual({ succeeded: true })
})

test("a command that writes out a vault path is refused and one that does not is allowed", async () => {
  const { vault, check } = await guardFixture()

  expect(await check({ kind: "command", command: `cat "${vault.path}/Note.md"` })).toEqual(refused)
  expect(await check({ kind: "command", command: "git status" })).toEqual({ succeeded: true })
})

test("the config file and the shipped skill stay readable", async () => {
  const { check, configPath } = await guardFixture()

  expect(await check({ kind: "file", path: configPath })).toEqual({ succeeded: true })
  expect(await check({ kind: "file", path: join(process.cwd(), "skills", "obsidian-memory", "SKILL.md") })).toEqual({
    succeeded: true,
  })
})

test("with no config, an invalid config or an unreadable config nothing is guarded", async () => {
  const { check, vault, configPath, context } = await guardFixture()
  const request = { kind: "file", path: join(vault.path, "Note.md") } as const

  await writeFile(configPath, "{ not json")
  expect(await check(request)).toEqual({ succeeded: true })
  await writeRegistrationSnapshot(context, "")
  expect(await check(request)).toEqual({ succeeded: true })
  const folder = await useTempFolder()
  expect(
    await checkVaultAccess({ configPath: folder, cwd: folder, home: homedir(), platform: testPlatform(), request }),
  ).toEqual({
    succeeded: true,
  })
})

test("the config is read on every call, so a vault registered later is guarded at once", async () => {
  const { check, config, context, root } = await guardFixture()
  const later = join(root, "later-vault")
  await mkdir(later)
  const request = { kind: "file", path: join(later, "Note.md") } as const
  expect(await check(request)).toEqual({ succeeded: true })

  await writeRegistrationSnapshot(
    context,
    JSON.stringify({ ...config, projects: [{ name: "later", folder: context.workingFolder, vault: later }] }),
  )

  expect(await check(request)).toEqual(refused)
})

test("the config file and the index and model folders can be read, written and named in any command", async () => {
  const { check, configPath, dataFolder } = await guardFixture()
  const index = join(dataFolder, "index", "abc.sqlite")

  for (const path of [configPath, index, join(dataFolder, "models", "model.onnx")]) {
    expect(await check({ kind: "file", path })).toEqual({ succeeded: true })
    expect(await check({ kind: "command", command: `echo {} > "${path}"` })).toEqual({ succeeded: true })
  }
  expect(await check({ kind: "command", command: `Get-Content "${configPath}"` })).toEqual({ succeeded: true })
  expect(await check({ kind: "command", command: `rm -rf "${dataFolder}"` })).toEqual({ succeeded: true })
})

test("the config file stays editable when it is missing or invalid, so a broken config can be repaired", async () => {
  const { check, configPath } = await guardFixture()
  await writeFile(configPath, "{ not json")

  expect(await check({ kind: "file", path: configPath })).toEqual({ succeeded: true })
  await rm(configPath)
  expect(await check({ kind: "file", path: configPath })).toEqual({ succeeded: true })
})

test("with no config registered a raw device path is not guarded", async () => {
  const { check, configPath } = await guardFixture()
  await rm(configPath)

  expect(await check({ kind: "file", path: String.raw`\\.\PhysicalDrive0` })).toEqual({ succeeded: true })
})

test.runIf(process.platform === "win32")(
  "a raw device or a namespace path that cannot be read is refused through the guard",
  async () => {
    const { check } = await guardFixture()

    for (const kind of ["file", "tree", "listing"] as const) {
      expect(await check({ kind, path: String.raw`\\.\PhysicalDrive0` })).toEqual(refused)
    }
  },
)

test.runIf(process.platform !== "win32")(
  "a process-relative path under /proc/self/fd or /dev/fd is refused through the guard",
  async () => {
    const { check } = await guardFixture()

    for (const kind of ["file", "tree", "listing"] as const) {
      expect(await check({ kind, path: "/proc/self/fd/3" })).toEqual(refused)
      expect(await check({ kind, path: "/dev/fd/0" })).toEqual(refused)
    }
  },
)
