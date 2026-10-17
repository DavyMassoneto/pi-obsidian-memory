import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readExecutedScripts } from "#src/services"
import { runsPackageScript, runsScript, useTempFolder } from "#test-helpers"

test("collects script files and package script lines, listing what is missing", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "a.js"), "a\n")
  await writeFile(join(folder, "package.json"), JSON.stringify({ scripts: { gen: "node a.js" } }))
  const files = [runsScript("a.js"), runsScript("none.js"), runsPackageScript("gen"), runsPackageScript("other")]
  expect(await readExecutedScripts(folder, files)).toEqual({
    succeeded: true,
    output: {
      scripts: [
        { path: "a.js", text: "a\n" },
        { path: "package.json#scripts.gen", text: "node a.js" },
      ],
      missing: ["none.js", "package.json#scripts.other"],
    },
  })
})

test("a script whose path has a space is read, and one under a file instead of a folder is missing", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "my script.js"), "x\n")
  await writeFile(join(folder, "plain.txt"), "y\n")
  const files = [runsScript("my script.js"), runsScript("plain.txt/inner.js")]
  expect(await readExecutedScripts(folder, files)).toEqual({
    succeeded: true,
    output: { scripts: [{ path: "my script.js", text: "x\n" }], missing: ["plain.txt/inner.js"] },
  })
})

test("a script that exists but cannot be read refuses", async () => {
  const folder = await useTempFolder()
  await mkdir(join(folder, "dir.js"))
  expect((await readExecutedScripts(folder, [runsScript("dir.js")])).succeeded).toBe(false)
})
