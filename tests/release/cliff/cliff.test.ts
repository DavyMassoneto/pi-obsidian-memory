import { copyFileSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { bumpedVersion, previewChangelog, writeChangelog } from "#scripts"
import { cleanupTempDirs, commit, git, REPO_ROOT, tag, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

function repoWithProjectCliffConfig(): string {
  const dir = tempDir()
  git(dir, "init", "-q", "-b", "main")
  copyFileSync(join(REPO_ROOT, "cliff.toml"), join(dir, "cliff.toml"))
  return dir
}

function repoAt(version: string, ...messages: string[]): string {
  const dir = repoWithProjectCliffConfig()
  commit(dir, "chore: base")
  tag(dir, `v${version}`)
  for (const message of messages) commit(dir, message)
  return dir
}

describe("bumpedVersion", () => {
  it("uses the initial version 0.0.1 when there is no tag", async () => {
    const dir = repoWithProjectCliffConfig()
    commit(dir, "docs: first commit")

    expect(await bumpedVersion(dir, "v", "auto")).toBe("0.0.1")
  })

  it.each([
    ["fix: fixes a bug", "0.1.1"],
    ["perf: speeds up", "0.1.1"],
    ["feat: adds a feature", "0.2.0"],
    ["feat!: breaks the API (in 0.x it bumps the minor)", "0.2.0"],
    ["docs: only documentation", "0.1.0"],
  ])("after v0.1.0, %j → %s", async (message, expected) => {
    expect(await bumpedVersion(repoAt("0.1.0", message), "v", "auto")).toBe(expected)
  })

  it("from 1.0 on, a breaking change bumps the major", async () => {
    expect(await bumpedVersion(repoAt("1.2.3", "feat!: new API"), "v", "auto")).toBe("2.0.0")
  })

  it("forces the requested bump", async () => {
    expect(await bumpedVersion(repoAt("0.1.0", "docs: only documentation"), "v", "patch")).toBe("0.1.1")
  })

  it("rejects a version without the expected tag prefix", async () => {
    await expect(bumpedVersion(repoAt("0.1.0", "fix: fixes a bug"), "release-", "auto")).rejects.toThrow(
      /without the tag prefix/,
    )
  })
})

describe("changelog", () => {
  it("groups by type, formats scopes and skips release commits", async () => {
    const dir = repoAt(
      "0.1.0",
      "feat(search): semantic search",
      "fix: handles accents",
      "chore(release): v0.1.1",
      "docs: installation guide",
    )

    const preview = await previewChangelog(dir, "v0.2.0")

    expect(preview).toMatch(/^## \[0\.2\.0\] - \d{4}-\d{2}-\d{2}/)
    expect(preview).toContain("### Features")
    expect(preview).toContain("**search:** Semantic search")
    expect(preview).toContain("### Bug Fixes")
    expect(preview).toContain("### Maintenance")
    expect(preview).not.toContain("chore(release)")
    expect(preview).not.toContain("# Changelog")
  })

  it("regenerates CHANGELOG.md with the header", async () => {
    const dir = repoAt("0.1.0", "feat: adds a feature")

    await writeChangelog(dir, "v0.2.0")

    const text = readFileSync(join(dir, "CHANGELOG.md"), "utf8")
    expect(text.startsWith("# Changelog")).toBe(true)
    expect(text).toContain("## [0.2.0]")
    expect(text).toContain("## [0.1.0]")
  })

  it("explains a git-cliff failure", async () => {
    await expect(previewChangelog(tempDir(), "v0.2.0")).rejects.toThrow(/git-cliff failed: .+/)
  })
})
