import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import { readConfigSnapshot } from "#src/services"
import { registrationFixture } from "#test-helpers"

test("preservation: schema-invalid snapshot retains contradictory resources and exact unpublished bytes", async () => {
  const fixture = await registrationFixture()
  try {
    const embeddings = { provider: "openai", model: "gemini-embedding-001" }
    const decisionModel = { model: "jev-latest", maxTokens: 4000, headMaxTokens: 100 }
    const text = `${JSON.stringify({ ...fixture.config, embeddings, decisionModel }, null, 2)}\r\n`
    await mkdir(dirname(fixture.path))
    await writeFile(fixture.path, text)
    const problems = [
      "embeddings.model: must be one of text-embedding-3-small",
      "decisionModel: must have required properties provider",
    ]
    expect(await readConfigSnapshot({ path: fixture.path })).toMatchObject({
      succeeded: true,
      output: {
        state: "present",
        hash: createHash("sha256").update(text).digest("hex"),
        text,
        lexicalParse: { succeeded: false, problems },
        repair: {
          replacementRequired: false,
          embeddings,
          decisionModel: { provider: "laya", endpoint: "http://127.0.0.1:8000/v1/systemone", ...decisionModel },
          problems,
        },
      },
    })
    expect(await readFile(fixture.path, "utf8")).toBe(text)
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

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
