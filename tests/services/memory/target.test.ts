import { expect, test } from "vitest"

import { targetVault } from "#/services"
import { aConfig } from "#test-helpers"

test("targets the global vault for the global scope, wherever pi runs", () => {
  expect(targetVault(aConfig(), "global", "D:/Downloads")).toEqual({
    succeeded: true,
    output: { path: "C:/Users/Administrator/OneDrive/Obisidian/Global memory", name: "Global memory" },
  })
})

test("targets the vault of the project pi runs in", () => {
  expect(targetVault(aConfig(), "project", "D:/Projects/loja/admin/src")).toEqual({
    succeeded: true,
    output: { path: "C:/vaults/loja-admin", name: "loja-admin" },
  })
})

test("refuses the project scope in a folder with no registered project", () => {
  expect(targetVault(aConfig(), "project", "D:/Downloads")).toEqual({
    succeeded: false,
    reason: "no-project",
    problems: ["D:/Downloads has no registered project: run /memory-init, or use the global scope"],
  })
})
