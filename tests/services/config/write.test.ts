import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { proposeInit, proposeSetup, readConfigSnapshot, writeConfig } from "#src/services"
import { customizedSettings, registrationFixture } from "#test-helpers"

test("publishes only once, replaces only matching bytes and never touches old vault files", async () => {
  const fixture = await registrationFixture()
  Object.assign(fixture.config, customizedSettings())
  try {
    const note = join(fixture.config.global.vault, "keep.md")
    await writeFile(note, "user bytes\r\n")
    const initial = await writeConfig({ ...fixture, expectedHash: null })
    expect(initial).toMatchObject({ succeeded: true, warnings: [] })
    if (!initial.succeeded) {
      throw new Error("initial failed")
    }
    const bytes = await readFile(fixture.path)
    expect(await writeConfig({ ...fixture, expectedHash: null })).toMatchObject({
      succeeded: false,
      reason: "conflict",
    })
    expect(await readFile(fixture.path)).toEqual(bytes)
    const proposal = proposeSetup({ config: fixture.config, vault: join(fixture.root, "new-vault") })
    if (!proposal.succeeded) throw new Error("setup proposal failed")
    const config = proposal.output
    expect(config).toEqual({ ...fixture.config, global: { vault: join(fixture.root, "new-vault") } })
    expect(await writeConfig({ ...fixture, config, expectedHash: initial.output.hash })).toMatchObject({
      succeeded: true,
      warnings: [],
    })
    expect(JSON.parse(await readFile(fixture.path, "utf8"))).toEqual(config)
    expect(await readFile(note, "utf8")).toBe("user bytes\r\n")
    expect(await readdir(dirname(fixture.path))).toEqual(["config.json"])
    expect(await readdir(fixture.root)).not.toContain("new-vault")
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("an external edit conflicts, retaining exact newest bytes", async () => {
  const fixture = await registrationFixture()
  try {
    const initial = await writeConfig({ ...fixture, expectedHash: null })
    if (!initial.succeeded) {
      throw new Error("initial failed")
    }
    await writeFile(fixture.path, "user edit")
    expect(await writeConfig({ ...fixture, expectedHash: initial.output.hash })).toMatchObject({
      succeeded: false,
      reason: "conflict",
    })
    expect(await readFile(fixture.path, "utf8")).toBe("user edit")
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("invalid JSON requires explicit replacement confirmation as well as its snapshot hash", async () => {
  const fixture = await registrationFixture()
  try {
    await mkdir(dirname(fixture.path))
    await writeFile(fixture.path, "{ malformed")
    const snapshot = await readConfigSnapshot({ path: fixture.path })
    if (!snapshot.succeeded || snapshot.output.state !== "present") {
      throw new Error("snapshot missing")
    }
    const request = { ...fixture, expectedHash: snapshot.output.hash }
    expect(await writeConfig(request)).toMatchObject({ succeeded: false, reason: "replacement-required" })
    expect(await readFile(fixture.path, "utf8")).toBe("{ malformed")
    expect(await writeConfig({ ...request, replacementConfirmed: true })).toMatchObject({ succeeded: true })
    expect(JSON.parse(await readFile(fixture.path, "utf8"))).toEqual(fixture.config)
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("actual writes reject unsafe infrastructure and malformed proposals without touching disk", async () => {
  const fixture = await registrationFixture()
  try {
    const path = join(fixture.config.global.vault, "config.json")
    expect(await writeConfig({ ...fixture, path, expectedHash: null })).toMatchObject({ succeeded: false })
    expect(await readdir(fixture.config.global.vault)).toEqual([])
    const config = { ...fixture.config, global: { vault: "relative" } }
    expect(await writeConfig({ ...fixture, config, expectedHash: null })).toMatchObject({ succeeded: false })
    const withCredentials = {
      ...fixture.config,
      embeddings: { ...fixture.config.embeddings, apiKey: "must-not-be-serialized" },
    }
    expect(await writeConfig({ ...fixture, config: withCredentials, expectedHash: null })).toMatchObject({
      succeeded: false,
      reason: "invalid-config",
      problems: ["embeddings.apiKey: not a known field"],
    })
    expect(await readdir(fixture.root)).not.toContain("machine")
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("init from a registered subfolder repoints only that entry and preserves old project bytes", async () => {
  const fixture = await registrationFixture()
  Object.assign(fixture.config, customizedSettings())
  try {
    const project = fixture.config.projects[0]
    if (!project) {
      throw new Error("fixture project missing")
    }
    const note = join(project.vault, "keep.md")
    const bytes = Buffer.from([0, 13, 10, 255, 42])
    await writeFile(note, bytes)
    const initial = await writeConfig({ ...fixture, expectedHash: null })
    if (!initial.succeeded) {
      throw new Error("initial failed")
    }
    const proposal = proposeInit({
      config: fixture.config,
      folder: join(project.folder, "src"),
      name: project.name,
      vault: join(fixture.root, "new-project"),
    })
    if (!proposal.succeeded) {
      throw new Error("proposal failed")
    }
    expect(await writeConfig({ ...fixture, config: proposal.output, expectedHash: initial.output.hash })).toMatchObject(
      {
        succeeded: true,
      },
    )
    expect(proposal.output).toEqual({
      ...fixture.config,
      projects: [{ ...project, vault: join(fixture.root, "new-project") }],
    })
    expect(JSON.parse(await readFile(fixture.path, "utf8"))).toEqual(proposal.output)
    expect(await readFile(note)).toEqual(bytes)
    expect(await readdir(project.vault)).toEqual(["keep.md"])
    expect(await readdir(fixture.root)).not.toContain("new-project")
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("competing writers never both publish against the same snapshot", async () => {
  const fixture = await registrationFixture()
  try {
    const initial = await writeConfig({ ...fixture, expectedHash: null })
    if (!initial.succeeded) {
      throw new Error("initial failed")
    }
    const results = await Promise.all([
      writeConfig({
        ...fixture,
        config: { ...fixture.config, limits: { ...fixture.config.limits, maxBodyChars: 11, maxStatementChars: 22 } },
        expectedHash: initial.output.hash,
      }),
      writeConfig({
        ...fixture,
        config: { ...fixture.config, limits: { ...fixture.config.limits, maxBodyChars: 33, maxStatementChars: 44 } },
        expectedHash: initial.output.hash,
      }),
    ])
    expect(results.filter((result) => result.succeeded)).toHaveLength(1)
    expect(await readdir(dirname(fixture.path))).toEqual(["config.json"])
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
