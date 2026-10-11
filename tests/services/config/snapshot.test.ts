import { createHash } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import { readConfigSnapshot } from "#/services"
import { registrationFixture } from "#test-helpers"

test("snapshot distinguishes absence, unreadable destinations and invalid content with exact byte hash", async () => {
  const fixture = await registrationFixture()
  try {
    expect(await readConfigSnapshot({ path: fixture.path })).toEqual({
      succeeded: true,
      output: { state: "missing", hash: null },
    })
    expect(await readConfigSnapshot({ path: fixture.root })).toMatchObject({ succeeded: false })
    await mkdir(dirname(fixture.path))
    const text = "{ invalid\r\n"
    await writeFile(fixture.path, text)
    expect(await readConfigSnapshot({ path: fixture.path })).toMatchObject({
      succeeded: true,
      output: {
        state: "present",
        hash: createHash("sha256").update(text).digest("hex"),
        text,
        lexicalParse: { succeeded: false },
        repair: { replacementRequired: true },
      },
    })
    await writeFile(fixture.path, JSON.stringify(fixture.config))
    expect(await readConfigSnapshot({ path: fixture.path })).toMatchObject({
      succeeded: true,
      output: {
        state: "present",
        lexicalParse: { succeeded: true, output: fixture.config },
        repair: { replacementRequired: false },
      },
    })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
