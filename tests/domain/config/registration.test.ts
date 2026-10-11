import { expect, test } from "vitest"

import { inspectConfigForRepair, parseConfig, prepareSetupDefaults, proposeInit, proposeSetup } from "#/domain"
import { aConfig } from "#test-helpers"

test.each(["relative/vault", "C:relative", "\\vault"])("requires an absolute vault: %s", (vault) => {
  expect(parseConfig(JSON.stringify({ ...aConfig(), global: { vault } })).succeeded).toBe(false)
})

test("reports duplicate names, working folders and overlapping vaults together", () => {
  const config = aConfig()
  config.projects.push({ name: "LOJA", folder: "d:\\projects\\LOJA\\", vault: `${config.global.vault}/child` })
  expect(parseConfig(JSON.stringify(config))).toMatchObject({
    succeeded: false,
    problems: expect.arrayContaining([
      expect.stringContaining("projects.2.name"),
      expect.stringContaining("projects.2.folder"),
      expect.stringContaining("projects.2.vault"),
    ]),
  })
})

test("accepts nested project roots but refuses vault ancestors, equals and dot aliases", () => {
  expect(parseConfig(JSON.stringify(aConfig())).succeeded).toBe(true)
  for (const vault of ["C:/vaults", "c:\\VAULTS\\loja", "C:/vaults/other/../loja/child"]) {
    const config = aConfig()
    config.global.vault = vault
    expect(parseConfig(JSON.stringify(config)).succeeded).toBe(false)
  }
})

test("setup changes only the global registration without mutating its input", () => {
  const config = aConfig()
  const before = JSON.stringify(config)
  expect(proposeSetup({ config, vault: "C:/new-global" })).toEqual({
    succeeded: true,
    output: { ...config, global: { vault: "C:/new-global" } },
  })
  expect(JSON.stringify(config)).toBe(before)
})

test("setup completes a new draft but refuses incomplete repaired registrations instead of dropping them", () => {
  expect(proposeSetup({ config: prepareSetupDefaults(), vault: "C:/new-global" })).toEqual({
    succeeded: true,
    output: {
      global: { vault: "C:/new-global" },
      projects: [],
      limits: { maxBodyChars: 1000, maxStatementChars: 100 },
    },
  })
  const draft = inspectConfigForRepair(
    JSON.stringify({ ...aConfig(), projects: [{ name: "keep", folder: "D:/keep" }] }),
  )
  expect(proposeSetup({ config: draft, vault: "C:/new-global" })).toMatchObject({
    succeeded: false,
    problems: [expect.stringContaining("projects.0")],
  })
})

test("init in a registered subfolder repoints the most specific entry and retains its root", () => {
  const config = aConfig()
  const result = proposeInit({ config, folder: "D:/Projects/loja/admin/src", name: "admin", vault: "C:/new-admin" })
  expect(result).toEqual({
    succeeded: true,
    output: {
      ...config,
      projects: [config.projects[0], { name: "admin", folder: "D:/Projects/loja/admin", vault: "C:/new-admin" }],
    },
  })
  expect(config.projects[1]?.name).toBe("loja-admin")
})

test("init appends an unregistered folder, rejects duplicate names and overlapping vaults", () => {
  const config = aConfig()
  expect(proposeInit({ config, folder: "D:/new", name: "new", vault: "C:/new" })).toMatchObject({ succeeded: true })
  expect(proposeInit({ config, folder: "D:/new", name: "LOJA", vault: "C:/new" }).succeeded).toBe(false)
  expect(proposeInit({ config, folder: "D:/new", name: "new", vault: "C:/vaults/loja/sub" }).succeeded).toBe(false)
})
