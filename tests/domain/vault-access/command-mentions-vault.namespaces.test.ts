import { expect, test } from "vitest"

import { commandMentionsVault } from "#src/domain"

const CWD = "D:\\work\\project"
const HOME = "C:\\Users\\ana"
const VAULT = "D:\\Notes"
const UNC_VAULT = "\\\\srv\\share\\Team Vault"

test.each([
  ["the device prefix", "type \\\\.\\D:\\Notes\\a.md"],
  ["the device prefix with slashes", "cat //./D:/Notes/a.md"],
  ["the device prefix in quotes", 'cat "\\\\.\\D:\\Notes\\a.md"'],
  ["a localhost admin share", "type \\\\localhost\\D$\\Notes\\a.md"],
  ["a loopback admin share in lower case", "type \\\\127.0.0.1\\d$\\notes"],
  ["an admin share with slashes", "cat //localhost/D$/Notes/a.md"],
  ["a quoted admin share", 'cat "\\\\localhost\\D$\\Notes\\a.md"'],
  ["an extended-length localhost share", "type \\\\?\\UNC\\localhost\\D$\\Notes\\a.md"],
  ["a device localhost share", "type \\\\.\\UNC\\127.0.0.1\\D$\\Notes\\a.md"],
])("finds the vault written with %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBe(VAULT)
})

test.each([
  ["a remote admin share", "cat \\\\srv\\D$\\Notes\\a.md"],
  ["an admin share of another drive", "cat \\\\localhost\\E$\\Notes\\a.md"],
  ["a longer name behind the admin share", "cat \\\\localhost\\D$\\Notes2\\a.md"],
  ["a device prefix in the middle of a word", "cat x\\\\.\\D:\\Notes\\a.md"],
])("does not find the vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBeNull()
})

test("finds a UNC vault written with the device UNC prefix", () => {
  expect(commandMentionsVault("type \\\\.\\UNC\\srv\\share\\Team Vault\\a.md", CWD, HOME, [UNC_VAULT])).toBe(UNC_VAULT)
})

test("keeps a path after a device prefix that sits inside another path intact", () => {
  expect(commandMentionsVault("cat D:\\Notes\\\\.\\a.md", CWD, HOME, [VAULT])).toBe(VAULT)
  expect(commandMentionsVault("cat D:\\Other\\\\.\\Notes\\a.md", CWD, HOME, [VAULT])).toBeNull()
})
