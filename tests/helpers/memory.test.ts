import { readFile, stat } from "node:fs/promises"
import { isAbsolute, join, relative } from "node:path"

import { expect, test } from "vitest"

import { parseConfig, resolveProject } from "#/domain"
import { setupRegisteredMemoryAdd, setupVaults } from "#test-helpers"

test.each([
  { name: "setupVaults", setup: setupVaults },
  { name: "setupRegisteredMemoryAdd", setup: setupRegisteredMemoryAdd },
])("$name isolates all registrations and working folders", async ({ setup }) => {
  const fixture = await setup()
  const parsed = parseConfig(await readFile(fixture.configPath, "utf8"))
  if (!parsed.succeeded) {
    throw new Error(parsed.problems.join("\n"))
  }

  const paths = [fixture.configPath, parsed.output.global.vault]
  for (const project of parsed.output.projects) {
    paths.push(project.folder, project.vault)
  }
  for (const path of paths) {
    const inside = relative(fixture.root, path)
    expect(isAbsolute(inside)).toBe(false)
    expect(inside.startsWith("..")).toBe(false)
    expect(inside).not.toBe("")
  }

  expect(fixture).toHaveProperty("projectFolder", join(fixture.root, "work", "loja"))
  expect(fixture).toHaveProperty("unregisteredFolder", join(fixture.root, "work", "unregistered"))
  for (const folder of [fixture.projectFolder, join(fixture.projectFolder, "src"), fixture.unregisteredFolder]) {
    expect((await stat(folder)).isDirectory()).toBe(true)
  }
  expect(resolveProject(parsed.output, join(fixture.projectFolder, "src"))).toMatchObject({
    succeeded: true,
    output: { vault: fixture.projectVault },
  })
  expect(resolveProject(parsed.output, fixture.unregisteredFolder)).toEqual({ succeeded: false })
  expect(parsed.output).toEqual(fixture.config)
})
