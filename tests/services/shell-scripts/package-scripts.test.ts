import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readPackageScripts } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("reads named script lines from the nearest package.json above the working folder", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "package.json"), JSON.stringify({ scripts: { gen: "node gen.js", test: "vitest run" } }))
  await mkdir(join(folder, "sub"))
  expect(await readPackageScripts(join(folder, "sub"), "", ["gen", "absent"])).toEqual({
    succeeded: true,
    output: {
      scripts: [{ path: "package.json#scripts.gen", text: "node gen.js" }],
      missing: ["package.json#scripts.absent"],
    },
  })
})

test("an empty list of script names finds nothing and misses nothing", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "package.json"), "{ not json")
  expect(await readPackageScripts(folder, "", [])).toEqual({ succeeded: true, output: { scripts: [], missing: [] } })
})

test("a package.json that is not JSON, or whose scripts are not text, is refused", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "package.json"), "{ not json")
  expect((await readPackageScripts(folder, "", ["gen"])).succeeded).toBe(false)
  await writeFile(join(folder, "package.json"), JSON.stringify({ scripts: { gen: 1 } }))
  expect((await readPackageScripts(folder, "", ["gen"])).succeeded).toBe(false)
})

test("a prefix reads the package.json inside that folder, not the nearest one above", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "package.json"), JSON.stringify({ scripts: { build: "echo root" } }))
  await mkdir(join(folder, "app"))
  await writeFile(join(folder, "app", "package.json"), JSON.stringify({ scripts: { build: "node gen.js" } }))
  expect(await readPackageScripts(folder, "app", ["build"])).toEqual({
    succeeded: true,
    output: { scripts: [{ path: "app/package.json#scripts.build", text: "node gen.js" }], missing: [] },
  })
})

test("a prefix folder without package.json misses the script instead of reading the root one", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "package.json"), JSON.stringify({ scripts: { build: "echo root" } }))
  await mkdir(join(folder, "app"))
  expect(await readPackageScripts(folder, "app", ["build"])).toEqual({
    succeeded: true,
    output: { scripts: [], missing: ["app/package.json#scripts.build"] },
  })
})
