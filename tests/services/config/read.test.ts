import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readConfig } from "#/services/config"
import { aConfig, useTempVault } from "#test-helpers"

test("reads a valid config file", async () => {
  const folder = await useTempVault()
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify(aConfig(), null, 2))

  expect(await readConfig(path)).toEqual({ succeeded: true, output: aConfig() })
})

test("tells the memory is not configured when the file does not exist", async () => {
  const folder = await useTempVault()

  expect(await readConfig(join(folder, "config.json"))).toEqual({
    succeeded: false,
    reason: "not-configured",
    problems: ["memory is not configured: run /memory-setup"],
  })
})

test("refuses an invalid file with every problem", async () => {
  const folder = await useTempVault()
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify({ ...aConfig(), theme: "dark" }))

  expect(await readConfig(path)).toEqual({
    succeeded: false,
    reason: "invalid-config",
    problems: ["theme: not a known field"],
  })
})
