import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, dirname, join } from "node:path"

import { expect, test } from "vitest"

import { writeConfig } from "#src/services"
import { registrationFixture } from "#test-helpers"

test("an existing cooperative writer lock is never stolen or removed", async () => {
  const fixture = await registrationFixture()
  try {
    await mkdir(dirname(fixture.path))
    const lock = join(dirname(fixture.path), `.${basename(fixture.path)}.lock`)
    await writeFile(lock, "another writer")
    expect(await writeConfig({ ...fixture, expectedHash: null })).toMatchObject({
      succeeded: false,
      reason: "unavailable",
    })
    expect(await readFile(lock, "utf8")).toBe("another writer")
    expect(await readdir(dirname(fixture.path))).toEqual([basename(lock)])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("a directory at the config path remains intact and leaves no temporary files", async () => {
  const fixture = await registrationFixture()
  try {
    await mkdir(fixture.path, { recursive: true })
    await writeFile(join(fixture.path, "keep"), "existing directory")
    expect(await writeConfig({ ...fixture, expectedHash: null })).toMatchObject({
      succeeded: false,
      reason: "unavailable",
    })
    expect(await readFile(join(fixture.path, "keep"), "utf8")).toBe("existing directory")
    expect(await readdir(dirname(fixture.path))).toEqual(["config.json"])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
