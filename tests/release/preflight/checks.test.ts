import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { PreflightContext } from "#scripts"
import { cleanWorkingTree, inSyncWithRemote, noOpenRelease, onDevelopBranch, versionMatchesLatestTag } from "#scripts"
import { CONFIG, cleanupTempDirs, commit, git, repoOnDevWithRemote, tag, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

const contextOf = (cwd: string): PreflightContext => ({ cwd, config: CONFIG, remote: "origin" })

describe("onDevelopBranch", () => {
  it("passes on dev and blocks on another branch", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(onDevelopBranch(contextOf(repo))).toEqual([])

    git(repo, "checkout", "-q", "main")
    expect(onDevelopBranch(contextOf(repo))).toEqual([expect.stringMatching(/from dev \(current branch: main\)/)])
  })

  it("explains a detached HEAD", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    git(repo, "checkout", "-q", "--detach")

    expect(onDevelopBranch(contextOf(repo))).toEqual([expect.stringMatching(/from dev \(detached HEAD\)/)])
  })
})

describe("cleanWorkingTree", () => {
  it("blocks uncommitted files", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(cleanWorkingTree(contextOf(repo))).toEqual([])

    writeFileSync(join(repo, "draft.txt"), "x")
    expect(cleanWorkingTree(contextOf(repo))).toEqual([expect.stringMatching(/uncommitted changes/)])
  })
})

describe("noOpenRelease", () => {
  it("blocks when a release is already open", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(noOpenRelease(contextOf(repo))).toEqual([])

    git(repo, "branch", "release/0.2.0")
    expect(noOpenRelease(contextOf(repo))).toEqual([expect.stringMatching(/release\/0\.2\.0/)])
  })
})

describe("inSyncWithRemote", () => {
  it("blocks a branch with commits that were not pushed yet", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(inSyncWithRemote("develop")(contextOf(repo))).toEqual([])

    commit(repo, "feat: not pushed yet")
    expect(inSyncWithRemote("develop")(contextOf(repo))).toEqual([
      expect.stringMatching(/local dev .* differs from origin\/dev/),
    ])
    expect(inSyncWithRemote("main")(contextOf(repo))).toEqual([])
  })

  it("explains when the remote cannot be reached", () => {
    const repo = tempDir()
    git(repo, "init", "-q", "-b", "dev")
    commit(repo, "chore: initial commit")

    expect(inSyncWithRemote("develop")(contextOf(repo))).toEqual([expect.stringMatching(/could not reach origin/)])
  })
})

describe("versionMatchesLatestTag", () => {
  it("passes without tags and with the tag of the current version", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(versionMatchesLatestTag(contextOf(repo))).toEqual([])

    tag(repo, "v0.1.0")
    expect(versionMatchesLatestTag(contextOf(repo))).toEqual([])
  })

  it("blocks when package.json does not match the latest tag", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    tag(repo, "v0.2.0")

    expect(versionMatchesLatestTag(contextOf(repo))).toEqual([expect.stringMatching(/0\.1\.0.*v0\.2\.0/)])
  })
})
