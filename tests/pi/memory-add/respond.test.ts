import { expect, test } from "vitest"

import { respondTo } from "#/pi"
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

test("guides setup and project selection using config paths and global scope", () => {
  const missing = respondTo({
    succeeded: false,
    reason: "not-configured",
    configPath: "C:/agent/memory/config.json",
    problems: ["memory is not configured"],
  })
  const noProject = respondTo({
    succeeded: false,
    reason: "no-project",
    workingFolder: "D:/work",
    configPath: "C:/agent/memory/config.json",
    problems: ["D:/work has no registered project"],
  })

  expect(textOf(missing)).toContain("C:/agent/memory/config.json")
  expect(textOf(noProject)).toContain("global scope")
  expect(missing.isError).toBe(true)
  expect(noProject.isError).toBe(true)
})
