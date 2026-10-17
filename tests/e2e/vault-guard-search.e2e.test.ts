import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { expect, test } from "vitest"

import {
  e2eWorld,
  expectVaultRefusal,
  onlyProject,
  rewriteConfig,
  runAllowed,
  searches,
  storedConfig,
  type WorldOptions,
} from "#test-helpers"

const worldOptions: WorldOptions = {
  memory: "configured",
  tools: ["grep", "find", "ls"],
  modelCache: "shared",
  capture: "at-session-end",
}

test("find pattern and grep glob with a vault prefix are refused, absolute, upward or from another folder", async () => {
  const world = await e2eWorld(worldOptions)
  const { globalVault, cwd } = world.folders
  const calls = [
    ...searches(`${globalVault.replaceAll("\\", "/")}/**/*.md`),
    ...searches("../global-vault/*.md"),
    ...searches("../../global-vault/*.md", join(cwd, "src")),
  ]
  for (const call of calls) await expectVaultRefusal(world, call)
})

test("find pattern and grep glob with a home-relative prefix into a vault are refused", async () => {
  const world = await e2eWorld(worldOptions)
  const vault = join(homedir(), "pi-memory-guard-test-vault")
  const config = await storedConfig(world)
  await rewriteConfig(world, { global: { ...config.global, vault } })
  for (const call of searches("~/pi-memory-guard-test-vault/**")) await expectVaultRefusal(world, call)
})

test("grep, find and ls with no path use the working folder, which is refused when it is a vault", async () => {
  const world = await e2eWorld(worldOptions)
  const project = await onlyProject(world)
  await rewriteConfig(world, { projects: [{ ...project, vault: world.folders.cwd }] })
  await expectVaultRefusal(world, { tool: "grep", args: { pattern: "x" } })
  await expectVaultRefusal(world, { tool: "find", args: { pattern: "*.md" } })
  await expectVaultRefusal(world, { tool: "ls", args: { limit: 100 } })
})

test("find and grep with a plain, relative or outside glob run, and a grep pattern that looks like a vault path is not a path", async () => {
  const world = await e2eWorld(worldOptions)
  const { cwd, globalVault } = world.folders
  await mkdir(join(cwd, "src"))
  await writeFile(join(cwd, "src", "a.ts"), "export const x = 1")
  const outside = join(world.folders.root, "outside-files").replaceAll("\\", "/")
  await mkdir(outside)
  await writeFile(join(outside, "b.md"), "x")
  for (const glob of ["*.ts", "**/*.md", "src/**/*.ts", `${outside}/**/*.md`, "../outside-files/*.md"]) {
    for (const call of searches(glob, cwd)) await runAllowed(world, call)
  }
  await runAllowed(world, { tool: "grep", args: { pattern: globalVault.replaceAll("\\", "/"), path: cwd } })
  expect(await runAllowed(world, { tool: "grep", args: { pattern: "export", glob: "src/**/*.ts", path: cwd } })).toBe(
    "src/a.ts:1: export const x = 1",
  )
})
