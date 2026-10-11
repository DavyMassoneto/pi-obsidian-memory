import { mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { canonicalizeRegistration } from "#/services"
import { registrationFixture } from "#test-helpers"

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

test.runIf(process.platform === "win32")("does not infer a drive for rooted Windows paths", async () => {
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
