import { expect, test } from "vitest"

import { comparablePath, isInside, pathsOverlap, resolveProject, vaultNameOf } from "#src/domain"
import { aConfig } from "#test-helpers"

test.each([
  ["its exact folder", "D:/Projects/loja", "loja"],
  ["a folder inside it", "D:/Projects/loja/src/api", "loja"],
  ["the most specific of two nested projects", "D:/Projects/loja/admin/src", "loja-admin"],
  ["the folder in another case", "d:/projects/LOJA", "loja"],
  ["the folder with Windows separators", "D:\\Projects\\loja\\src", "loja"],
  ["the folder with a trailing separator", "D:/Projects/loja/", "loja"],
])("finds the project for %s", (_case, folder, name) => {
  expect(resolveProject(aConfig(), folder, "win32")).toMatchObject({ succeeded: true, output: { name } })
})

test.each([
  ["C:/Users/Administrator/OneDrive/Obisidian/Global memory", "Global memory"],
  ["C:\\vaults\\loja", "loja"],
  ["C:/vaults/loja/", "loja"],
  ["C:/", "C:"],
])("names the vault after its folder: %s", (path, name) => {
  expect(vaultNameOf(path, "win32")).toBe(name)
})

test.each(["C:\\Vaults\\Memory\\", "c:/vaults/memory", "C:/VAULTS/Memory///"])(
  "compares equivalent vault paths identically: %s",
  (path) => {
    expect(comparablePath(path, "win32")).toBe("c:/vaults/memory")
  },
)

test("does not collapse distinct vault folder names", () => {
  expect(comparablePath("C:/vaults/memory-old", "win32")).not.toBe(comparablePath("C:/vaults/memory", "win32"))
})

test("root boundaries and dot segments do not evade containment", () => {
  expect(isInside("C:/work/project", "C:/", "win32")).toBe(true)
  expect(isInside("/work/project", "/", "win32")).toBe(true)
  expect(isInside("C:/work-old", "C:/work", "win32")).toBe(false)
  expect(pathsOverlap("C:/work/child/..", "c:\\work\\nested", "win32")).toBe(true)
  expect(comparablePath("\\\\server\\share\\folder\\..", "win32")).toBe("//server/share")
})

test("finds a project registered with Windows separators", () => {
  const config = { ...aConfig(), projects: [{ name: "api", folder: "D:\\Work\\api\\", vault: "C:/vaults/api" }] }

  expect(resolveProject(config, "D:/Work/api/src", "win32")).toMatchObject({
    succeeded: true,
    output: { name: "api" },
  })
})

test.each([
  ["a folder whose name only starts like a project", "D:/Projects/lojas"],
  ["a folder that is not registered", "D:/Downloads"],
  ["a folder above a project", "D:/Projects"],
])("finds no project for %s", (_case, folder) => {
  expect(resolveProject(aConfig(), folder, "win32")).toEqual({ succeeded: false })
})
