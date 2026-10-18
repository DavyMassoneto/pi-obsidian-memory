import { expect, test } from "vitest"

import { targetVault } from "#src/domain"
import { aConfig } from "#test-helpers"

test("targets the global vault for the global scope, wherever pi runs", () => {
  expect(targetVault(aConfig(), "global", "D:/Downloads", "win32")).toEqual({
    succeeded: true,
    output: { path: "C:/Users/Administrator/OneDrive/Obisidian/Global memory", name: "Global memory" },
  })
})

test("targets the vault of the project pi runs in", () => {
  expect(targetVault(aConfig(), "project", "D:/Projects/loja/admin/src", "win32")).toEqual({
    succeeded: true,
    output: { path: "C:/vaults/loja-admin", name: "loja-admin" },
  })
})

test("refuses an unregistered project with its working folder, without UI instructions", () => {
  expect(targetVault(aConfig(), "project", "D:/Downloads", "win32")).toEqual({
    succeeded: false,
    reason: "no-project",
    workingFolder: "D:/Downloads",
    problems: ["D:/Downloads has no registered project"],
  })
})
