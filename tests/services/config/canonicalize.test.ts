import { mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { canonicalizeConfigLocation, canonicalizeRegistration, canonicalizeWorkingFolder } from "#src/services"
import { productSettings, registrationFixture, useTempFolder } from "#test-helpers"

test("working-folder resolution uses supplied absolute paths and rejects files and broken aliases", async () => {
  const root = await useTempFolder()
  await mkdir(join(root, "work"))
  await symlink(join(root, "work"), join(root, "alias"), "junction")
  expect(await canonicalizeWorkingFolder(join(root, "alias", "future"))).toEqual({
    succeeded: true,
    output: join(await realpath(root), "work", "future"),
  })
  await writeFile(join(root, "file"), "preserve")
  await symlink(join(root, "missing"), join(root, "broken"), "junction")
  for (const path of ["relative", "C:relative", join(root, "file"), join(root, "broken")]) {
    expect(await canonicalizeWorkingFolder(path)).toMatchObject({
      succeeded: false,
      problems: [expect.stringContaining("workingFolder:")],
    })
  }
})

test("reports every independent filesystem failure with its config field", async () => {
  const root = await useTempFolder()
  const global = join(root, "global")
  const folder = join(root, "work")
  const vault = join(root, "vault")
  const otherVault = join(root, "other-vault")
  for (const path of [global, folder, vault, otherVault]) {
    await writeFile(path, "preserve")
  }
  const config = {
    global: { vault: global },
    projects: [
      { name: "first", folder, vault },
      { name: "second", folder: join(root, "other-work"), vault: otherVault },
    ],
    ...productSettings(),
  }

  expect(await canonicalizeConfigLocation({ config, configPath: join(root, "config.json") })).toEqual({
    succeeded: false,
    problems: [
      `global.vault: Error: ${global}: expected a directory`,
      `projects.0.folder: Error: ${folder}: expected a directory`,
      `projects.0.vault: Error: ${vault}: expected a directory`,
      `projects.1.vault: Error: ${otherVault}: expected a directory`,
    ],
  })
  for (const path of [global, folder, vault, otherVault]) {
    expect(await readFile(path, "utf8")).toBe("preserve")
  }
})

test("keeps genuine link diagnostics alongside independent registration and infrastructure failures", async () => {
  const root = await useTempFolder()
  const broken = join(root, "broken")
  const file = join(root, "file")
  await symlink(join(root, "missing"), broken, "junction")
  await writeFile(file, "preserve")
  const result = await canonicalizeRegistration({
    config: {
      global: { vault: broken },
      projects: [{ name: "project", folder: join(root, "work"), vault: file }],
      ...productSettings(),
    },
    configPath: join(file, "config.json"),
    indexPath: file,
  })

  expect(result).toEqual({
    succeeded: false,
    problems: [
      expect.stringMatching(/^global.vault: .*ENOENT/),
      `projects.0.vault: Error: ${file}: expected a directory`,
      `configPath: Error: ${await realpath(file)}: expected an existing ancestor directory`,
      `indexPath: Error: ${file}: expected a directory`,
    ],
  })
  expect(await readFile(file, "utf8")).toBe("preserve")
})

test("canonical junction aliases and missing suffixes cannot nest vaults", async () => {
  const fixture = await registrationFixture()
  try {
    const alias = join(fixture.root, "alias")
    await symlink(fixture.config.global.vault, alias, "junction")
    const project = fixture.config.projects[0]
    if (!project) {
      throw new Error("fixture project missing")
    }
    project.vault = join(alias, "new", "child")
    expect(
      await canonicalizeRegistration({
        config: fixture.config,
        configPath: fixture.path,
        indexPath: fixture.indexPath,
      }),
    ).toMatchObject({ succeeded: false, problems: [expect.stringContaining("vaults")] })
    expect(
      await canonicalizeRegistration({
        config: { ...fixture.config, projects: [] },
        configPath: fixture.path,
        indexPath: fixture.indexPath,
      }),
    ).toMatchObject({ succeeded: true })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("keeps config and index outside vaults including new destinations via an ancestor alias", async () => {
  const fixture = await registrationFixture()
  try {
    const alias = join(fixture.root, "alias")
    await symlink(fixture.config.global.vault, alias, "junction")
    for (const infrastructure of [
      { configPath: join(alias, "future", "config.json"), indexPath: fixture.indexPath },
      { configPath: fixture.path, indexPath: join(alias, "future", "index") },
    ]) {
      expect(await canonicalizeRegistration({ config: fixture.config, ...infrastructure })).toMatchObject({
        succeeded: false,
      })
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("refuses duplicate canonical working folders while allowing nested roots", async () => {
  const fixture = await registrationFixture()
  try {
    const work = join(fixture.root, "work")
    await mkdir(work)
    const alias = join(fixture.root, "work-alias")
    await symlink(work, alias, "junction")
    fixture.config.projects.push({ name: "second", folder: alias, vault: join(fixture.root, "second-vault") })
    expect(
      await canonicalizeRegistration({
        config: fixture.config,
        configPath: fixture.path,
        indexPath: fixture.indexPath,
      }),
    ).toMatchObject({ succeeded: false, problems: [expect.stringContaining("folder")] })
    fixture.config.projects[1] = {
      name: "second",
      folder: join(alias, "nested"),
      vault: join(fixture.root, "second-vault"),
    }
    expect(
      await canonicalizeRegistration({
        config: fixture.config,
        configPath: fixture.path,
        indexPath: fixture.indexPath,
      }),
    ).toMatchObject({ succeeded: true })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test.runIf(process.platform === "win32")("on Windows: does not infer a drive for rooted Windows paths", async () => {
  const fixture = await registrationFixture()
  try {
    expect(
      await canonicalizeRegistration({
        config: { ...fixture.config, global: { vault: "/unspecified-drive" } },
        configPath: fixture.path,
        indexPath: fixture.indexPath,
      }),
    ).toMatchObject({ succeeded: false })
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})

test("refuses broken links and files used as vault roots or ancestors instead of inventing a new suffix", async () => {
  const fixture = await registrationFixture()
  try {
    const broken = join(fixture.root, "broken")
    const file = join(fixture.root, "file")
    await symlink(join(fixture.root, "absent"), broken, "junction")
    await writeFile(file, "preserve")
    for (const vault of [broken, file, join(file, "child")]) {
      expect(
        await canonicalizeRegistration({
          config: { ...fixture.config, global: { vault } },
          configPath: fixture.path,
          indexPath: fixture.indexPath,
        }),
      ).toMatchObject({ succeeded: false })
    }
  } finally {
    await rm(fixture.root, { recursive: true, force: true })
  }
})
