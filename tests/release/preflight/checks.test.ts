import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import type { PreflightContext } from "#scripts"
import { cleanWorkingTree, inSyncWithRemote, noOpenRelease, onDevelopBranch, versionMatchesLatestTag } from "#scripts"
import { CONFIG, cleanupTempDirs, commit, git, repoOnDevWithRemote, tag, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

const contextOf = (cwd: string): PreflightContext => ({ cwd, config: CONFIG, remote: "origin" })

describe("onDevelopBranch", () => {
  it("passa na dev e barra em outra branch", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(onDevelopBranch(contextOf(repo))).toBeUndefined()

    git(repo, "checkout", "-q", "main")
    expect(onDevelopBranch(contextOf(repo))).toMatch(/a partir da dev \(branch atual: main\)/)
  })

  it("explica quando o HEAD está destacado", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    git(repo, "checkout", "-q", "--detach")

    expect(onDevelopBranch(contextOf(repo))).toMatch(/a partir da dev \(HEAD destacado\)/)
  })
})

describe("cleanWorkingTree", () => {
  it("barra arquivos não commitados", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(cleanWorkingTree(contextOf(repo))).toBeUndefined()

    writeFileSync(join(repo, "rascunho.txt"), "x")
    expect(cleanWorkingTree(contextOf(repo))).toMatch(/não commitadas/)
  })
})

describe("noOpenRelease", () => {
  it("barra quando já existe uma release aberta", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(noOpenRelease(contextOf(repo))).toBeUndefined()

    git(repo, "branch", "release/0.2.0")
    expect(noOpenRelease(contextOf(repo))).toMatch(/release\/0\.2\.0/)
  })
})

describe("inSyncWithRemote", () => {
  it("barra a branch com commits que ainda não foram enviados", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(inSyncWithRemote("develop")(contextOf(repo))).toBeUndefined()

    commit(repo, "feat: ainda não enviado")
    expect(inSyncWithRemote("develop")(contextOf(repo))).toMatch(/dev local .* difere de origin\/dev/)
    expect(inSyncWithRemote("main")(contextOf(repo))).toBeUndefined()
  })

  it("explica quando o remoto não pode ser consultado", () => {
    const repo = tempDir()
    git(repo, "init", "-q", "-b", "dev")
    commit(repo, "chore: início")

    expect(inSyncWithRemote("develop")(contextOf(repo))).toMatch(/não foi possível consultar origin/)
  })
})

describe("versionMatchesLatestTag", () => {
  it("passa sem tags e com a tag da versão atual", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    expect(versionMatchesLatestTag(contextOf(repo))).toBeUndefined()

    tag(repo, "v0.1.0")
    expect(versionMatchesLatestTag(contextOf(repo))).toBeUndefined()
  })

  it("barra quando o package.json não bate com a última tag", () => {
    const repo = repoOnDevWithRemote("0.1.0")
    tag(repo, "v0.2.0")

    expect(versionMatchesLatestTag(contextOf(repo))).toMatch(/0\.1\.0.*v0\.2\.0/)
  })
})
