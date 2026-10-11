import { expect, test } from "vitest"

import { ancestorFolders, checkMemoryFolder, checkVaultPath, joinVaultPath } from "#/domain"

test("joins vault path parts, skipping empty ones", () => {
  expect(joinVaultPath("", "pnpm", "", "index")).toBe("pnpm/index")
})

test.each([
  ["a nested folder", "tools/pnpm/ci", ["tools/pnpm/ci", "tools/pnpm", "tools", ""]],
  ["a top-level folder", "pnpm", ["pnpm", ""]],
  ["the vault root", "", [""]],
])("lists %s and every folder above it, up to the root", (_case, folder, expected) => {
  expect(ancestorFolders(folder)).toEqual(expected)
})

test.each([
  ["the vault root", ""],
  ["a folder", "pnpm"],
  ["a nested folder", "tools/pnpm/ci"],
  ["a folder that starts with two dots", "..notes"],
  ["the archive", "archive/tools"],
  ["a hidden folder", ".obsidian"],
])("accepts %s as a vault path", (_case, folder) => {
  expect(checkVaultPath(folder)).toEqual([])
})

test.each([
  ["the parent folder", "..", ['folder: ".." is not allowed']],
  ["a way out through the parent", "../other", ['folder: ".." is not allowed']],
  ["a way out in the middle", "tools/../../other", ['folder: ".." is not allowed']],
  ["the current folder", "tools/./pnpm", ['folder: "." is not allowed']],
  ["an empty part", "tools//pnpm", ["folder: has an empty part"]],
  ["a trailing slash", "tools/", ["folder: has an empty part"]],
  ["an absolute path", "/tools", ["folder: must be relative to the vault"]],
  ["a drive letter", "C:/tools", ["folder: must be relative to the vault"]],
  ["a backslash", "tools\\pnpm", ['folder: use "/" between folders']],
  ["a character Windows forbids", "tools/a*b", ['folder "a*b": "*" is not allowed in a file name']],
  ["a character that breaks links", "c#", ['folder "c#": "#" breaks Obsidian links']],
  ["a control character", "a\tb", ['folder "a\tb": has a control character']],
  ["a name reserved by Windows", "tools/aux", ['folder "aux": "aux" is reserved by Windows']],
  ["a leading space", " tools", ['folder " tools": starts or ends with a space']],
  ["a trailing dot", "tools.", ['folder "tools.": ends with a dot']],
])("refuses %s as a vault path", (_case, folder, problems) => {
  expect(checkVaultPath(folder)).toEqual(problems)
})

test("lists the problem of every part once", () => {
  expect(checkVaultPath("a//b//c*/..")).toEqual([
    "folder: has an empty part",
    'folder "c*": "*" is not allowed in a file name',
    'folder: ".." is not allowed',
  ])
})

test.each([
  ["the vault root", ""],
  ["a nested folder", "tools/pnpm"],
  ["a nested folder named like a reserved one", "tools/archive"],
])("accepts %s as a memory folder", (_case, folder) => {
  expect(checkMemoryFolder(folder)).toEqual([])
})

test.each([
  ["a way out of the vault", "../other", ['folder: ".." is not allowed']],
  ["a hidden folder", ".private", ['folder ".private": is hidden (starts with ".")']],
  ["a folder that starts with two dots", "tools/..notes", ['folder "..notes": is hidden (starts with ".")']],
  ["the archive", "archive/tools", ['folder "archive": is reserved for the vault']],
  ["the archive in another case", "Archive", ['folder "Archive": is reserved for the vault']],
  ["the templates", "_Templates/x", ['folder "_Templates": is reserved for the vault']],
])("refuses %s as a memory folder", (_case, folder, problems) => {
  expect(checkMemoryFolder(folder)).toEqual(problems)
})
