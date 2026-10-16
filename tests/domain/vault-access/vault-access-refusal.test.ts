import { expect, test } from "vitest"

import { VAULT_ACCESS_REFUSAL, vaultAccessRefusal } from "#src/domain"

const CWD = "D:\\work\\project"
const HOME = "C:\\Users\\ana"
const VAULT = "D:\\Notes"
const VAULTS = [VAULT]

test.each([
  ["a file in the vault", "D:\\Notes\\a.md"],
  ["a file in the vault in another case", "d:/notes/A.md"],
  ["a file with the @ prefix", "@D:\\Notes\\a.md"],
  ["a file with the extended-length prefix", "\\\\?\\D:\\Notes\\a.md"],
  ["a file reached with dot-dot", "..\\..\\Notes\\a.md"],
])("refuses a file tool on %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "file", path }, CWD, HOME, VAULTS)).toBe(VAULT)
})

test.each([
  ["a folder that only shares the name prefix", "D:\\Notes2\\a.md"],
  ["the parent folder", "D:\\"],
  ["a relative file in the project", "src\\a.ts"],
])("allows a file tool on %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "file", path }, CWD, HOME, VAULTS)).toBeNull()
})

test.each([
  ["the vault", "D:\\Notes"],
  ["a folder in the vault", "D:\\Notes\\tools"],
  ["an ancestor of the vault", "D:\\"],
  ["an ancestor reached with dot-dot", "..\\.."],
  ["an ancestor in another case", "d:/"],
])("refuses a recursive search from %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "tree", path }, CWD, HOME, VAULTS)).toBe(VAULT)
})

test.each([
  ["a sibling of the vault", "D:\\Other"],
  ["a folder that only shares the name prefix", "D:\\Notes2"],
  ["the project folder", "."],
  ["another drive", "E:\\"],
])("allows a recursive search from %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "tree", path }, CWD, HOME, VAULTS)).toBeNull()
})

test.each([
  ["the vault", "D:\\Notes"],
  ["a folder in the vault", "D:\\Notes\\tools"],
])("refuses a listing of %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "listing", path }, CWD, HOME, VAULTS)).toBe(VAULT)
})

test.each([
  ["an ancestor of the vault", "D:\\"],
  ["a sibling of the vault", "D:\\Other"],
])("allows a listing of %s, which shows only one level", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "listing", path }, CWD, HOME, VAULTS)).toBeNull()
})

test("refuses a command that mentions the vault", () => {
  expect(vaultAccessRefusal({ kind: "command", command: "type D:\\Notes\\a.md" }, CWD, HOME, VAULTS)).toBe(VAULT)
})

test("allows a command that does not mention the vault", () => {
  expect(vaultAccessRefusal({ kind: "command", command: "npm test" }, CWD, HOME, VAULTS)).toBeNull()
})

test("allows every request when there are no vaults", () => {
  expect(vaultAccessRefusal({ kind: "tree", path: "D:\\" }, CWD, HOME, [])).toBeNull()
})

test("the refusal names the memory tools and says never to use file tools or the shell", () => {
  expect(VAULT_ACCESS_REFUSAL).toContain("memory_search")
  expect(VAULT_ACCESS_REFUSAL).toContain("memory_get")
  expect(VAULT_ACCESS_REFUSAL).toMatch(/never/i)
})
