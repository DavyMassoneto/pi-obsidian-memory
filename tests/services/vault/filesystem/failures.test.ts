import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { listFolder, readNote } from "#/services"
import { aLimits, linkFolder, useTempFolder } from "#test-helpers"

test("reports an unreadable vault link loop rather than calling it missing", async () => {
  const root = await useTempFolder()
  const vault = join(root, "loop")
  await linkFolder(vault, vault)

  expect(await listFolder({ path: vault, limits: aLimits() }, "")).toMatchObject({ reason: "not-readable" })
})

test("reports a directory in the place of a note as not a note file, never as missing", async () => {
  const vault = await useTempFolder()
  await mkdir(join(vault, "Rule.md"))

  expect(await readNote({ path: vault, limits: aLimits() }, "", "Rule")).toMatchObject({
    succeeded: false,
    reason: "not-directory",
    problems: [expect.stringMatching(/Rule\.md cannot be read \(EISDIR\)$/)],
  })
})
