import { expect, test } from "vitest"

import { commandMentionsVault } from "#src/domain"

const CWD = "D:\\work\\project"
const HOME = "C:\\Users\\ana"
const VAULT = "D:\\Notes"
const HOME_VAULT = "C:\\Users\\ana\\Documents\\Vault"
const CWD_VAULT = "D:\\work\\project\\memory"
const UNC_VAULT = "\\\\srv\\share\\Team Vault"

test.each([
  ["an absolute path", "cat D:\\Notes\\a.md"],
  ["forward slashes", "cat D:/Notes/a.md"],
  ["mixed case", "type d:\\nOTES\\a.md"],
  ["repeated separators", "cat D:\\\\Notes//a.md"],
  ["double quotes", 'Get-Content "D:\\Notes\\a.md"'],
  ["single quotes", "Get-Content 'D:\\Notes\\a.md'"],
  ["backticks", "cat `D:\\Notes\\a.md`"],
  ["a quote inside the path", 'cat D:\\"Notes"\\a.md'],
  ["the vault folder alone", "ls D:\\Notes"],
  ["the vault folder before a pipe", "dir D:\\Notes| sort"],
  ["the vault folder before a semicolon", "dir D:\\Notes;echo done"],
  ["an option assignment", "tool --out=D:\\Notes\\a.md"],
  ["a trailing dot, which Windows ignores", "dir D:\\Notes."],
  ["the extended-length prefix", "type \\\\?\\D:\\Notes\\a.md"],
])("finds the vault written as %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBe(VAULT)
})

test.each([
  ["a folder that only shares the name prefix", "cat D:\\Notes2\\a.md"],
  ["a name that continues with a dash", "cat D:\\Notes-old\\a.md"],
  ["a sibling", "cat D:\\Other\\a.md"],
  ["another drive", "cat E:\\Notes\\a.md"],
  ["no path", "echo hello"],
  ["a drive letter inside a longer word", "cat xD:\\Notes\\a.md"],
])("does not find the vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBeNull()
})

test.each([
  ["a tilde", "cat ~/Documents/Vault/a.md"],
  ["a tilde with a backslash", "cat ~\\Documents\\Vault\\a.md"],
  ["$HOME", "cat $HOME/Documents/Vault/a.md"],
  ["$home in lower case", "cat $home/documents/vault/a.md"],
  ["%USERPROFILE%", "type %USERPROFILE%\\Documents\\Vault\\a.md"],
  ["$env:USERPROFILE", "Get-Content $env:USERPROFILE\\Documents\\Vault\\a.md"],
  ["$env:USERPROFILE in quotes", 'Get-Content "$env:USERPROFILE\\Documents\\Vault\\a.md"'],
  ["the absolute path", "cat C:\\Users\\ana\\Documents\\Vault\\a.md"],
])("finds a vault under the home folder written with %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [HOME_VAULT])).toBe(HOME_VAULT)
})

test.each([
  ["a tilde path to a name that continues", "cat ~/Documents/Vault2/a.md"],
  ["$HOME with a name that continues", "cat $HOME/Documents/Vaults/a.md"],
  ["a home path that is not the vault", "cat ~/Documents/a.md"],
])("does not find the home vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [HOME_VAULT])).toBeNull()
})

test.each([
  ["a relative path", "cat memory/a.md"],
  ["a relative path with backslashes", "type memory\\a.md"],
  ["a dot-slash path", "cat ./memory/a.md"],
  ["a dot-backslash path", "type .\\memory\\a.md"],
  ["mixed case", "type Memory\\A.md"],
  ["a quoted path", 'cat "memory/a.md"'],
  ["the folder alone", "ls memory"],
])("finds a vault under the working folder written as %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [CWD_VAULT])).toBe(CWD_VAULT)
})

test.each([
  ["a name that continues", "cat memory2/a.md"],
  ["a folder of the same name elsewhere", "cat docs/memory/a.md"],
  ["a longer word", "cat mymemory/a.md"],
  ["an absolute path elsewhere", "cat D:\\other\\memory\\a.md"],
])("does not find the working folder vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [CWD_VAULT])).toBeNull()
})

test.each([
  ["a script name that starts with the folder", "npm run memory-test"],
  ["a word that starts with the folder", "echo memoryless"],
  ["a file that starts with the folder", "cat memory2.md"],
  ["a file named like the folder", "cat memory.md"],
  ["a name that follows a dot", "cat file.memory/a.md"],
  ["a folder name with a longer prefix", "cat old-memory/a.md"],
])("does not find the working folder vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [CWD_VAULT])).toBeNull()
})

test.each([
  ["an equals sign", "tool --dir=memory/a.md"],
  ["a parenthesis", "(cat memory/a.md)"],
  ["a double-quoted backslash path", 'Get-Content "memory\\x.md"'],
  ["a dot-slash folder", "ls ./memory"],
  ["a pipe before the path", "echo x|cat memory/a.md"],
])("finds the working folder vault after %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [CWD_VAULT])).toBe(CWD_VAULT)
})

test.each([
  ["$env:HOME", "cat $env:HOME\\Documents\\Vault\\a.md"],
  ["braces", "cat \u0024{HOME}/Documents/Vault/a.md"],
  ["%HOMEDRIVE%%HOMEPATH%", "type %HOMEDRIVE%%HOMEPATH%\\Documents\\Vault\\a.md"],
])("finds a vault under the home folder written with %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [HOME_VAULT])).toBe(HOME_VAULT)
})

test.each([
  ["a Git Bash drive path", "cat /d/Notes/a.md"],
  ["a WSL drive path", "cat /mnt/d/notes/a.md"],
  ["a Cygwin drive path", "cat /cygdrive/d/Notes"],
])("finds the vault written as %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBe(VAULT)
})

test.each([
  ["a Git Bash path with a longer name", "cat /d/Notes2/a.md"],
  ["a path on another drive", "cat /e/Notes/a.md"],
])("does not find the vault in %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [VAULT])).toBeNull()
})

test.each([
  ["the working folder is the vault", "D:\\Notes", "D:\\Notes"],
  ["the working folder is inside the vault", "D:\\Notes\\tools\\deep", "D:\\Notes"],
  ["the working folder is inside the vault in another case", "d:/notes/tools", "D:\\Notes"],
])("refuses every command when %s", (_case, cwd, vault) => {
  expect(commandMentionsVault("echo hello", cwd, HOME, [vault])).toBe(vault)
})

test("does not refuse every command when the working folder is beside the vault", () => {
  expect(commandMentionsVault("echo hello", "D:\\Notes2", HOME, ["D:\\Notes"])).toBeNull()
})

test.each([
  ["backslashes", "D:\\work\\sub", "cat ..\\Notes\\a.md"],
  ["slashes from a deeper folder", "D:\\work\\project", "cat ../Notes/a.md"],
])("finds a vault beside the working folder written with dot-dot and %s", (_case, cwd, command) => {
  expect(commandMentionsVault(command, cwd, HOME, ["D:\\work\\Notes"])).toBe("D:\\work\\Notes")
})

test("does not match a dot-dot path that leads to a different folder", () => {
  expect(commandMentionsVault("cat ../../Notes/a.md", CWD, HOME, ["D:\\work\\Notes"])).toBeNull()
})

test.each([
  ["backslashes", "type \\\\srv\\share\\Team Vault\\a.md"],
  ["forward slashes", "cat //srv/share/Team Vault/a.md"],
  ["quotes and another case", 'cat "\\\\SRV\\share\\team vault\\a.md"'],
  ["the extended-length UNC prefix", "type \\\\?\\UNC\\srv\\share\\Team Vault\\a.md"],
])("finds a UNC vault written with %s", (_case, command) => {
  expect(commandMentionsVault(command, CWD, HOME, [UNC_VAULT])).toBe(UNC_VAULT)
})

test("does not find a UNC vault in a longer folder name", () => {
  expect(commandMentionsVault("type \\\\srv\\share\\Team Vault2\\a.md", CWD, HOME, [UNC_VAULT])).toBeNull()
})

test("finds a quoted vault path with spaces", () => {
  expect(commandMentionsVault('cat "D:\\My Notes\\a b.md"', CWD, HOME, ["D:\\My Notes"])).toBe("D:\\My Notes")
})

test("returns the vault that is mentioned among several", () => {
  expect(commandMentionsVault("cat D:\\Beta\\a.md", CWD, HOME, ["D:\\Alpha", "D:\\Beta"])).toBe("D:\\Beta")
})

test("finds nothing when there are no vaults", () => {
  expect(commandMentionsVault("cat D:\\Notes\\a.md", CWD, HOME, [])).toBeNull()
})
