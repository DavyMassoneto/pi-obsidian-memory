import { describe, expect, it } from "vitest"

import { shellEditDecision, shellEditGuardEnabled } from "#src/pi"

describe("shell-edit guard key", () => {
  it("a payload with shellEditGuard false turns the guard off", () => {
    expect(shellEditGuardEnabled({ shellEditGuard: false })).toBe(false)
  })

  it("a payload with shellEditGuard true turns the guard on", () => {
    expect(shellEditGuardEnabled({ shellEditGuard: true })).toBe(true)
  })

  it("a payload without shellEditGuard false keeps the guard on", () => {
    for (const payload of [undefined, null, {}, "false", 0]) {
      expect(shellEditGuardEnabled(payload)).toBe(true)
    }
  })

  it("with the guard on a shell command is checked", () => {
    expect(shellEditDecision(true, "echo hi > file.txt")).toBe("check")
  })

  it("with the guard off a shell command passes unchecked", () => {
    expect(shellEditDecision(false, "echo hi > file.txt")).toBe("pass")
  })

  it("a call without a shell command passes unchecked with the guard on or off", () => {
    expect(shellEditDecision(true, null)).toBe("pass")
    expect(shellEditDecision(false, null)).toBe("pass")
  })
})
