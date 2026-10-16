import { expect, test } from "vitest"

import { respondTo } from "#src/pi"
import { aNote, textOf } from "#test-helpers"

test("reports persistence with a maintenance warning instead of a failed save", () => {
  const response = respondTo({
    succeeded: true,
    output: {
      vaultName: "Global memory",
      folder: "tools",
      notePath: "tools/Use pnpm.md",
      stored: { note: aNote(), hash: "hash" },
      maintenanceProblems: ["outside-vault: index.md leads outside the vault"],
    },
  })

  expect(response.isError).toBe(false)
  expect(textOf(response)).toBe(
    "Saved in Global memory: tools/Use pnpm.md\nMaintenance warning: outside-vault: index.md leads outside the vault",
  )
})

test("reports all validation problems as actionable input corrections", () => {
  const response = respondTo({ succeeded: false, reason: "invalid", problems: ["statement: invalid", "body: empty"] })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("Not saved. Fix and call again:\n- statement: invalid\n- body: empty")
})

test("includes the current note without proposing an unavailable update operation", () => {
  const response = respondTo({
    succeeded: false,
    reason: "exists",
    problems: ["Use pnpm.md already exists"],
    existing: { note: aNote(), hash: "hash" },
  })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain(aNote().body)
  expect(textOf(response)).toContain("leave the existing note unchanged")
})

test("guides a missing or invalid config to /memory-setup and a project-less folder to /memory-init or global scope", () => {
  const missing = respondTo({
    succeeded: false,
    reason: "not-configured",
    configPath: "C:/agent/memory/config.json",
    problems: ["memory is not configured"],
  })
  const invalid = respondTo({
    succeeded: false,
    reason: "invalid-config",
    configPath: "C:/agent/memory/config.json",
    problems: ["limits: invalid", "context: missing"],
  })
  const noProject = respondTo({
    succeeded: false,
    reason: "no-project",
    workingFolder: "D:/work",
    configPath: "C:/agent/memory/config.json",
    problems: ["D:/work has no registered project"],
  })

  expect(textOf(missing)).toContain("ask the user to run /memory-setup")
  expect(textOf(invalid)).toContain("limits: invalid\ncontext: missing")
  expect(textOf(invalid)).toContain("ask the user to run /memory-setup")
  expect(textOf(noProject)).toContain("global scope")
  expect(textOf(noProject)).toContain("/memory-init")
  expect([missing, invalid, noProject].map((response) => response.isError)).toEqual([true, true, true])
})

test("reports an unreadable config without sending the user to /memory-setup", () => {
  const unreadable = respondTo({
    succeeded: false,
    reason: "unreadable",
    configPath: "C:/agent/memory/config.json",
    problems: ["C:/agent/memory/config.json: cannot read config (EACCES)"],
  })

  expect(unreadable.isError).toBe(true)
  expect(textOf(unreadable)).toContain("cannot read config (EACCES)")
  expect(textOf(unreadable)).not.toContain("/memory-setup")
})
