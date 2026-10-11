import { expect, test } from "vitest"

import { checkEdges, checkFileName, checkFileSystemName, checkLinkCharacters, checkTrailingEdge } from "#/domain"

test.each([
  ["a note", "Use pnpm, never npm.md"],
  ["an extension in capitals", "Rule.MD"],
  ["a name with characters that break links", "C# tips.md"],
  ["a folder index", "index.md"],
  ["a name starting with a space", " Rule.md"],
])("accepts %s as a file name", (_case, fileName) => {
  expect(checkFileName(fileName)).toEqual([])
})

test.each([
  ["an empty name", "", ["file name: is empty"]],
  ["the current folder", ".", ['file name: "." is not allowed']],
  ["the parent folder", "..", ['file name: ".." is not allowed']],
  ["a slash", "sub/Rule.md", ['file name "sub/Rule.md": "/" is not allowed in a file name']],
  ["a backslash", "..\\x.md", ['file name "..\\x.md": "\\" is not allowed in a file name']],
  ["a drive letter", "C:x.md", ['file name "C:x.md": ":" is not allowed in a file name']],
  ["a control character", "a\nb.md", ['file name "a\nb.md": has a control character']],
  ["a name reserved by Windows", "con.md", ['file name "con.md": "con.md" is reserved by Windows']],
  ["a trailing space", "Rule.md ", ['file name "Rule.md ": ends with a space']],
  ["a trailing dot", "Rule.md.", ['file name "Rule.md.": ends with a dot']],
])("refuses %s as a file name", (_case, fileName, problems) => {
  expect(checkFileName(fileName)).toEqual(problems)
})

test("distinguishes readable disk names from safe link names", () => {
  expect(checkFileSystemName("name", "Bad#name")).toEqual([])
  expect(checkLinkCharacters("name", "Bad#name")).toEqual(['name: "#" breaks Obsidian links'])
})

test.each(["[", "]", "#", "^"])("reports link syntax characters exactly: %s", (character) => {
  expect(checkLinkCharacters("name", `a${character}b`)).toEqual([`name: "${character}" breaks Obsidian links`])
})

test("reports every filesystem problem together", () => {
  expect(checkFileSystemName("name", "CON.\t?*")).toEqual([
    'name: "?" is not allowed in a file name',
    'name: "*" is not allowed in a file name',
    "name: has a control character",
    'name: "CON.\t?*" is reserved by Windows',
  ])
})

test("allows a reserved-name prefix and dot-prefixed names", () => {
  expect(checkFileSystemName("name", "Console")).toEqual([])
  expect(checkFileSystemName("name", ".Visible")).toEqual([])
})

test.each([
  [" leading", ["name: starts or ends with a space"], []],
  ["trailing ", ["name: starts or ends with a space"], ["name: ends with a space"]],
  ["trailing.", ["name: ends with a dot"], ["name: ends with a dot"]],
  ["valid", [], []],
])("applies leading-space policy only where requested: %s", (name, edges, trailing) => {
  expect(checkEdges("name", name)).toEqual(edges)
  expect(checkTrailingEdge("name", name)).toEqual(trailing)
})
