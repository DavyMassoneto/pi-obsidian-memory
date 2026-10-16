import { describe, expect, it } from "vitest"

import { isFullyQualifiedPath } from "#src/services"

describe.skipIf(process.platform !== "win32")("fully qualified paths on Windows", () => {
  it.each([
    "C:\\Users\\note.md",
    "C:/Users/note.md",
    "C:\\",
    "\\\\server\\share\\note.md",
    "//server/share/note.md",
    "\\\\localhost\\C$\\Users",
    "\\\\?\\C:\\Users\\note.md",
    "\\\\.\\C:\\Users\\note.md",
    "\\\\?\\Volume{af64f707-be17-45d7-8358-0cc2a64dcc55}\\Users\\note.md",
    "\\\\.\\Volume{af64f707-be17-45d7-8358-0cc2a64dcc55}\\Users\\note.md",
  ])("accepts %s", (path) => {
    expect(isFullyQualifiedPath(path)).toBe(true)
  })

  it.each(["", "note.md", "relative\\note.md", "..\\note.md", "C:note.md", "C:", "\\Users\\note.md", "/Users/note.md"])(
    "rejects %j",
    (path) => {
      expect(isFullyQualifiedPath(path)).toBe(false)
    },
  )
})

describe.skipIf(process.platform === "win32")("fully qualified paths on POSIX", () => {
  it("accepts rooted paths and rejects relative ones", () => {
    expect(isFullyQualifiedPath("/home/user/note.md")).toBe(true)
    expect(isFullyQualifiedPath("home/user/note.md")).toBe(false)
    expect(isFullyQualifiedPath("")).toBe(false)
  })
})
