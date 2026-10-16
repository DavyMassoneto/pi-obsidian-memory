import { expect, test } from "vitest"

import { type ChangeFailure, reportFailure, reportSuccess } from "#src/pi"
import { textOf } from "#test-helpers"

const path = "tools/Use pnpm.md"

test("a success is one line, then a warning line for each maintenance problem", () => {
  const response = reportSuccess(`Updated in global: ${path}`, ["index a", "index b"])

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(
    `Updated in global: ${path}\nMaintenance warning: index a\nMaintenance warning: index b`,
  )
  expect(textOf(reportSuccess("Done", []))).toBe("Done")
})

test("not read says to read it with memory_get and call again", () => {
  const response = reportFailure({ succeeded: false, reason: "not-read", problems: ["x"] }, path)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    `Not changed: ${path} was not read with memory_get in this session. Read it, then call again.`,
  )
})

test("a conflict says the user's edit was kept and to read it again", () => {
  const response = reportFailure({ succeeded: false, reason: "conflict", problems: ["x"] }, path)

  expect(textOf(response)).toBe(
    `Not changed: ${path} changed on disk since it was read; the user's edit was kept. Read it again with memory_get.`,
  )
})

test("a replaced session says the configuration changed and to read the note again", () => {
  const response = reportFailure({ succeeded: false, reason: "stale-session", problems: ["jargon"] }, path)

  expect(textOf(response)).toBe(
    "Not changed: the memory configuration changed during this session. Read the note again with memory_get, then call again.",
  )
})

test("a partial result lists what was published, the original's state and says not to call again", () => {
  const response = reportFailure(
    {
      succeeded: false,
      reason: "partial",
      problems: ["disk full", "index warning"],
      published: ["archive/a.md", "b.md"],
      originalState: "missing",
    },
    path,
  )

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    "Partly done: disk full; index warning. Published: archive/a.md, b.md. Original: missing. Do not call again; ask the user to check the vault.",
  )
})

test("an invalid change lists every problem to fix", () => {
  const response = reportFailure({ succeeded: false, reason: "invalid", problems: ["body: empty", "type: bad"] }, path)

  expect(textOf(response)).toBe("Not changed. Fix and call again:\n- body: empty\n- type: bad")
})

test.each(["needs-fixing", "archived", "stale-vault"] as const)(
  "a %s refusal says not changed with its problem",
  (reason) => {
    const response = reportFailure({ succeeded: false, reason, problems: ["the problem"] }, path)

    expect(textOf(response)).toBe("Not changed: the problem")
  },
)

test("a taken name says not changed with the existing path", () => {
  const failure: ChangeFailure = {
    succeeded: false,
    reason: "exists",
    problems: ["tools/Use bun.md exists"],
    existingStatement: "Use bun",
  }

  expect(textOf(reportFailure(failure, path))).toBe("Not changed: tools/Use bun.md exists")
})

test.each(["not-configured", "invalid-config"] as const)("a %s config refusal points to /memory-setup", (reason) => {
  const response = reportFailure({ succeeded: false, reason, problems: ["config problem"], configPath: "c.json" }, path)

  expect(textOf(response)).toBe("config problem\nMemory is off: ask the user to run /memory-setup.")
})

test.each(["not-found", "not-writable", "cancelled", "admission-refused"] as const)(
  "any other refusal (%s) gives its problems",
  (reason) => {
    const response = reportFailure({ succeeded: false, reason, problems: ["first", "second"] }, path)

    expect(response.isError).toBe(true)
    expect(textOf(response)).toBe("first\nsecond")
  },
)
