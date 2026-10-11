import { writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readConfig } from "#/services"
import { aConfig, useTempFolder } from "#test-helpers"

test("reads a valid config file", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify(aConfig(), null, 2))

  expect(await readConfig(path)).toEqual({ succeeded: true, output: aConfig() })
})

test("tells the memory is not configured when the file does not exist", async () => {
  const folder = await useTempFolder()

  expect(await readConfig(join(folder, "config.json"))).toEqual({
    succeeded: false,
    reason: "not-configured",
    configPath: join(folder, "config.json"),
    problems: ["memory is not configured"],
  })
})

test("refuses an invalid file with every problem", async () => {
  const folder = await useTempFolder()
  const path = join(folder, "config.json")
  await writeFile(path, JSON.stringify({ ...aConfig(), theme: "dark" }))

  expect(await readConfig(path)).toEqual({
    succeeded: false,
    reason: "invalid-config",
    configPath: path,
    problems: ["theme: not a known field"],
  })
})
