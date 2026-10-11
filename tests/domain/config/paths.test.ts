import { expect, test } from "vitest"

import { comparablePath, resolveProject, vaultNameOf } from "#/domain"
import { aConfig } from "#test-helpers"

test.each([
  ["its exact folder", "D:/Projects/loja", "loja"],
  ["a folder inside it", "D:/Projects/loja/src/api", "loja"],
  ["the most specific of two nested projects", "D:/Projects/loja/admin/src", "loja-admin"],
  ["the folder in another case", "d:/projects/LOJA", "loja"],
  ["the folder with Windows separators", "D:\\Projects\\loja\\src", "loja"],
  ["the folder with a trailing separator", "D:/Projects/loja/", "loja"],
])("finds the project for %s", (_case, folder, name) => {
  expect(resolveProject(aConfig(), folder)).toMatchObject({ succeeded: true, output: { name } })
})

test.each([
  ["C:/Users/Administrator/OneDrive/Obisidian/Global memory", "Global memory"],
  ["C:\\vaults\\loja", "loja"],
  ["C:/vaults/loja/", "loja"],
])("names the vault after its folder: %s", (path, name) => {
  expect(vaultNameOf(path)).toBe(name)
})

test.each(["C:\\Vaults\\Memory\\", "c:/vaults/memory", "C:/VAULTS/Memory///"])(
  "compares equivalent vault paths identically: %s",
  (path) => {
    expect(comparablePath(path)).toBe("c:/vaults/memory")
  },
)

test("does not collapse distinct vault folder names", () => {
  expect(comparablePath("C:/vaults/memory-old")).not.toBe(comparablePath("C:/vaults/memory"))
})

test("finds a project registered with Windows separators", () => {
  const config = { ...aConfig(), projects: [{ name: "api", folder: "D:\\Work\\api\\", vault: "C:/vaults/api" }] }

  expect(resolveProject(config, "D:/Work/api/src")).toMatchObject({ succeeded: true, output: { name: "api" } })
})

test.each([
  ["a folder whose name only starts like a project", "D:/Projects/lojas"],
  ["a folder that is not registered", "D:/Downloads"],
  ["a folder above a project", "D:/Projects"],
])("finds no project for %s", (_case, folder) => {
  expect(resolveProject(aConfig(), folder)).toEqual({ succeeded: false })
})
