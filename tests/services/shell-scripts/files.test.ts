import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readScriptText } from "#src/services"
import { useTempFolder } from "#test-helpers"

test("reads a script's text, reports a missing one as absent and refuses one that cannot be read", async () => {
  const folder = await useTempFolder()
  await writeFile(join(folder, "a.js"), "console.log(1)\n")
  await mkdir(join(folder, "dir.js"))
  expect(await readScriptText(join(folder, "a.js"))).toEqual({ succeeded: true, output: "console.log(1)\n" })
  expect(await readScriptText(join(folder, "none.js"))).toEqual({ succeeded: false })
  const unreadable = await readScriptText(join(folder, "dir.js"))
  expect(unreadable.succeeded).toBe(false)
  expect("problems" in unreadable && unreadable.problems[0]).toContain("dir.js")
})
