import { describe, expect, it } from "vitest"

import { isNamespaceVolumeRoot } from "#src/services"

const GUID = "{af64f707-be17-45d7-8358-0cc2a64dcc55}"

describe("namespace volume roots", () => {
  it.each([
    `\\\\?\\Volume${GUID}`,
    `\\\\?\\Volume${GUID}\\`,
    `\\\\.\\Volume${GUID}`,
    `\\\\.\\Volume${GUID}\\`,
    `\\\\?\\volume${GUID}\\`,
  ])("recognizes %s", (path) => {
    expect(isNamespaceVolumeRoot(path)).toBe(true)
  })

  it.each([
    "",
    "C:\\",
    "\\\\server\\share\\",
    "\\\\?\\C:\\",
    `\\\\?\\Volume${GUID}\\Users`,
    `\\\\?\\Volume${GUID}\\\\`,
    `\\\\x\\Volume${GUID}\\`,
    `\\?\\Volume${GUID}\\`,
    `Volume${GUID}`,
    "\\\\?\\Volume{}\\",
    "\\\\?\\Volume\\",
    `prefix\\\\?\\Volume${GUID}\\`,
  ])("rejects %j", (path) => {
    expect(isNamespaceVolumeRoot(path)).toBe(false)
  })
})
