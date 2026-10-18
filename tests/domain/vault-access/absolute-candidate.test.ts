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
  ["the device prefix", "\\\\.\\D:\\Notes\\a.md", "D:\\Notes\\a.md"],
  ["the device prefix with slashes", "//./D:/Notes/a.md", "D:\\Notes\\a.md"],
  ["the device UNC prefix", "\\\\.\\UNC\\srv\\share\\Notes", "\\\\srv\\share\\Notes"],
  ["a localhost admin share", "\\\\localhost\\C$\\Users\\a.md", "C:\\Users\\a.md"],
  ["a loopback admin share in lower case", "\\\\127.0.0.1\\d$\\Notes", "D:\\Notes"],
  ["an admin share root", "\\\\LOCALHOST\\c$", "C:\\"],
  ["an admin share with slashes", "//localhost/C$/Users", "C:\\Users"],
  ["an extended-length localhost share", "\\\\?\\UNC\\localhost\\C$\\Users", "C:\\Users"],
  ["a device localhost share", "\\\\.\\UNC\\127.0.0.1\\C$\\Users", "C:\\Users"],
  ["a volume GUID path", "\\\\?\\Volume{0123-ab}\\Notes\\a.md", "\\\\?\\Volume{0123-ab}\\Notes\\a.md"],
  ["a device volume GUID path", "\\\\.\\Volume{0123-ab}\\Notes", "\\\\.\\Volume{0123-ab}\\Notes"],
  ["a volume GUID path with slashes", "//?/Volume{0123-ab}/Notes", "\\\\?\\Volume{0123-ab}\\Notes"],
  ["a device that is not a drive", "\\\\.\\PhysicalDrive0", "\\\\.\\PhysicalDrive0"],
  ["a volume GUID root", "\\\\?\\Volume{0123-ab}", "\\\\?\\Volume{0123-ab}"],
  ["a remote admin share", "\\\\srv\\C$\\Users", "\\\\srv\\C$\\Users"],
  ["a named local share", "\\\\localhost\\share\\Notes", "\\\\localhost\\share\\Notes"],
  ["an empty path", "", CWD],
])("resolves %s", (_case, raw, expected) => {
  expect(absoluteCandidate(raw, CWD, HOME, "win32")).toBe(expected)
})
