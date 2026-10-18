import { expect, test } from "vitest"

import { absoluteCandidate, type PathPlatform } from "#src/domain"

const CWD = "/home/ana/project"
const HOME = "/home/ana"
const PLATFORMS: PathPlatform[] = ["linux", "darwin"]

test.each(PLATFORMS)("resolves posix paths on %s", (platform) => {
  expect(absoluteCandidate("docs\\a.md", CWD, HOME, platform)).toBe("/home/ana/project/docs\\a.md")
  expect(absoluteCandidate("docs/a.md", CWD, HOME, platform)).toBe("/home/ana/project/docs/a.md")
  expect(absoluteCandidate("../other/a.md", CWD, HOME, platform)).toBe("/home/ana/other/a.md")
  expect(absoluteCandidate("/d/Notes/a.md", CWD, HOME, platform)).toBe("/d/Notes/a.md")
  expect(absoluteCandidate("/mnt/d/Notes/a.md", CWD, HOME, platform)).toBe("/mnt/d/Notes/a.md")
  expect(absoluteCandidate("~", CWD, HOME, platform)).toBe(HOME)
  expect(absoluteCandidate("~/N/a.md", CWD, HOME, platform)).toBe("/home/ana/N/a.md")
  expect(absoluteCandidate("@docs/a.md", CWD, HOME, platform)).toBe("/home/ana/project/docs/a.md")
  expect(absoluteCandidate("/My\u00A0Notes/a.md", CWD, HOME, platform)).toBe("/My Notes/a.md")
  expect(absoluteCandidate("file:///srv/a.md", CWD, HOME, platform)).toBe("/srv/a.md")
  expect(absoluteCandidate("", CWD, HOME, platform)).toBe(CWD)
})
