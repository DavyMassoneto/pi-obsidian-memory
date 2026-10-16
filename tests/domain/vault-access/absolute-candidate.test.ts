import { expect, test } from "vitest"

import { absoluteCandidate } from "#src/domain"

const CWD = "D:\\work\\project"
const HOME = "C:\\Users\\ana"

test.each([
  ["an absolute path", "D:\\Notes\\a.md", "D:\\Notes\\a.md"],
  ["forward slashes", "D:/Notes/a.md", "D:\\Notes\\a.md"],
  ["a relative path", "docs\\a.md", "D:\\work\\project\\docs\\a.md"],
  ["a dot-dot path", "..\\other\\a.md", "D:\\work\\other\\a.md"],
  ["a dot-dot inside an absolute path", "D:\\Notes\\x\\..\\a.md", "D:\\Notes\\a.md"],
  ["the @ prefix", "@D:\\Notes\\a.md", "D:\\Notes\\a.md"],
  ["the @ prefix on a relative path", "@docs/a.md", "D:\\work\\project\\docs\\a.md"],
  ["a unicode space", "D:\\My\u00A0Notes\\a.md", "D:\\My Notes\\a.md"],
  ["an ideographic space", "D:\\My\u3000Notes", "D:\\My Notes"],
  ["a lone tilde", "~", HOME],
  ["a tilde with a slash", "~/Notes/a.md", "C:\\Users\\ana\\Notes\\a.md"],
  ["a tilde with a backslash", "~\\Notes\\a.md", "C:\\Users\\ana\\Notes\\a.md"],
  ["a Git Bash drive path", "/d/Notes/a.md", "D:\\Notes\\a.md"],
  ["a Git Bash drive root", "/d", "D:\\"],
  ["a rooted path that is not a drive", "/data/a.md", "D:\\data\\a.md"],
  ["a WSL drive path", "/mnt/d/Notes/a.md", "D:\\Notes\\a.md"],
  ["a Cygwin drive path", "/cygdrive/d/Notes/a.md", "D:\\Notes\\a.md"],
  ["a file URL", "file:///D:/Notes/a.md", "D:\\Notes\\a.md"],
  ["the extended-length prefix", "\\\\?\\D:\\Notes\\a.md", "D:\\Notes\\a.md"],
  ["the extended-length prefix with slashes", "//?/D:/Notes/a.md", "D:\\Notes\\a.md"],
  ["the extended-length UNC prefix", "\\\\?\\UNC\\srv\\share\\Notes", "\\\\srv\\share\\Notes"],
  ["a UNC path", "\\\\srv\\share\\Notes", "\\\\srv\\share\\Notes"],
  ["an empty path", "", CWD],
])("resolves %s", (_case, raw, expected) => {
  expect(absoluteCandidate(raw, CWD, HOME)).toBe(expected)
})
