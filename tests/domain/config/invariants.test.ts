import { expect, test } from "vitest"

import { infrastructureProblems, registeredVaults, registrationProblems } from "#src/domain"
import { aConfig } from "#test-helpers"

test("reports every side of a conflicting registration without choosing one to discard", () => {
  const config = aConfig()
  config.projects.push({ name: "LOJA", folder: "d:/projects/loja/", vault: "C:/vaults/loja/child" })
  expect(registrationProblems(config)).toEqual([
    "projects.0.name and projects.2.name: duplicate registration",
    "projects.0.folder and projects.2.folder: duplicate registration",
    "projects.0.vault and projects.2.vault: vaults must not be equal or nested",
  ])
})

test("infrastructure excludes roots inside vaults and vaults inside the index", () => {
  const config = aConfig()
  expect(
    infrastructureProblems({ config, configPath: `${config.global.vault}/config.json`, indexPath: "C:/vaults" }),
  ).toEqual([
    "configPath and global.vault: config must remain outside vaults",
    "indexPath and projects.0.vault: index and vaults must not overlap",
    "indexPath and projects.1.vault: index and vaults must not overlap",
  ])
  expect(
    infrastructureProblems({ config, configPath: "C:/machine/config.json", indexPath: "C:/machine/index" }),
  ).toEqual([])
})

test("partial repair entries keep source field identities even when their siblings are absent", () => {
  expect(registeredVaults({ global: {}, projects: [{}, { vault: "C:/vault" }] })).toEqual([
    { field: "projects.1.vault", path: "C:/vault" },
  ])
})
