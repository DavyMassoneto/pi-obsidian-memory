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
  expect(vaultAccessRefusal({ kind: "file", path }, CWD, HOME, VAULTS, "win32")).toBe(VAULT)
})

test.each([
  ["a folder that only shares the name prefix", "D:\\Notes2\\a.md"],
  ["the parent folder", "D:\\"],
  ["a relative file in the project", "src\\a.ts"],
])("allows a file tool on %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "file", path }, CWD, HOME, VAULTS, "win32")).toBeNull()
})

test.each([
  ["the vault", "D:\\Notes"],
  ["a folder in the vault", "D:\\Notes\\tools"],
  ["an ancestor of the vault", "D:\\"],
  ["an ancestor reached with dot-dot", "..\\.."],
  ["an ancestor in another case", "d:/"],
])("refuses a recursive search from %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "tree", path }, CWD, HOME, VAULTS, "win32")).toBe(VAULT)
})

test.each([
  ["a sibling of the vault", "D:\\Other"],
  ["a folder that only shares the name prefix", "D:\\Notes2"],
  ["the project folder", "."],
  ["another drive", "E:\\"],
])("allows a recursive search from %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "tree", path }, CWD, HOME, VAULTS, "win32")).toBeNull()
})

test.each([
  ["the vault", "D:\\Notes"],
  ["a folder in the vault", "D:\\Notes\\tools"],
])("refuses a listing of %s", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "listing", path }, CWD, HOME, VAULTS, "win32")).toBe(VAULT)
})

test.each([
  ["an ancestor of the vault", "D:\\"],
  ["a sibling of the vault", "D:\\Other"],
])("allows a listing of %s, which shows only one level", (_case, path) => {
  expect(vaultAccessRefusal({ kind: "listing", path }, CWD, HOME, VAULTS, "win32")).toBeNull()
})

test("refuses a command that mentions the vault", () => {
  const request = { kind: "command", command: "type D:\\Notes\\a.md" } as const

  expect(vaultAccessRefusal(request, CWD, HOME, VAULTS, "win32")).toBe(VAULT)
})

test("allows a command that does not mention the vault", () => {
  const request = { kind: "command", command: "npm test" } as const

  expect(vaultAccessRefusal(request, CWD, HOME, VAULTS, "win32")).toBeNull()
})

test("allows every request when there are no vaults", () => {
  expect(vaultAccessRefusal({ kind: "tree", path: "D:\\" }, CWD, HOME, [], "win32")).toBeNull()
})

test("refuses posix paths and commands on linux", () => {
  const vaults = ["/home/ana/vaults/Global"]
  const file = { kind: "file", path: "~/vaults/Global/a.md" } as const
  const command = { kind: "command", command: "cat $HOME/vaults/Global/a.md" } as const
  const sibling = { kind: "file", path: "/home/ana/vaults/Globalx/a.md" } as const

  expect(vaultAccessRefusal(file, "/home/ana/project", "/home/ana", vaults, "linux")).toBe(vaults[0])
  expect(vaultAccessRefusal(command, "/home/ana/project", "/home/ana", vaults, "linux")).toBe(vaults[0])
  expect(vaultAccessRefusal(sibling, "/home/ana/project", "/home/ana", vaults, "linux")).toBeNull()
})

test("the refusal names the memory tools and says never to use file tools or the shell", () => {
  expect(VAULT_ACCESS_REFUSAL).toContain("memory_search")
  expect(VAULT_ACCESS_REFUSAL).toContain("memory_get")
  expect(VAULT_ACCESS_REFUSAL).toMatch(/never/i)
})
