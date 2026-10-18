import { expect, test } from "vitest"

import { vaultBelow, vaultContaining } from "#src/domain"

const VAULTS = ["D:\\Notes", "\\\\srv\\share\\Team Vault"]

test.each([
  ["the vault itself", "D:\\Notes", "D:\\Notes"],
  ["a file in the vault", "D:\\Notes\\tools\\a.md", "D:\\Notes"],
  ["another case", "d:\\NOTES\\a.md", "D:\\Notes"],
  ["forward slashes", "D:/Notes/a.md", "D:\\Notes"],
  ["repeated separators", "D:\\\\Notes\\\\a.md", "D:\\Notes"],
  ["a trailing separator", "D:\\Notes\\", "D:\\Notes"],
  ["a file in a UNC vault", "\\\\SRV\\Share\\team vault\\a.md", "\\\\srv\\share\\Team Vault"],
  ["a UNC path with slashes", "//srv/share/Team Vault/a.md", "\\\\srv\\share\\Team Vault"],
])("finds the vault containing %s", (_case, path, expected) => {
  expect(vaultContaining(path, VAULTS, "win32")).toBe(expected)
})

test.each([
  ["a folder that only shares the name prefix", "D:\\Notes2\\a.md"],
  ["a sibling folder", "D:\\Other\\a.md"],
  ["the parent of the vault", "D:\\"],
  ["another drive", "E:\\Notes\\a.md"],
  ["another UNC share", "\\\\srv\\share2\\Team Vault\\a.md"],
  ["a UNC share parent", "\\\\srv\\share"],
])("finds no vault containing %s", (_case, path) => {
  expect(vaultContaining(path, VAULTS, "win32")).toBeNull()
})

test.each([
  ["the parent folder", "D:\\", "D:\\Notes"],
  ["the vault itself", "D:\\Notes", "D:\\Notes"],
  ["another case", "d:\\", "D:\\Notes"],
  ["a UNC share", "\\\\srv\\share", "\\\\srv\\share\\Team Vault"],
])("finds the vault below %s", (_case, path, expected) => {
  expect(vaultBelow(path, VAULTS, "win32")).toBe(expected)
})

test.each([
  ["a sibling folder", "D:\\Other"],
  ["a folder that only shares the name prefix", "D:\\Note"],
  ["a file in the vault", "D:\\Notes\\a.md"],
  ["another drive", "E:\\"],
])("finds no vault below %s", (_case, path) => {
  expect(vaultBelow(path, VAULTS, "win32")).toBeNull()
})
