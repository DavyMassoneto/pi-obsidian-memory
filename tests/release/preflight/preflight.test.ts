import { writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  cleanWorkingTree,
  inSyncWithRemote,
  noOpenRelease,
  onDevelopBranch,
} from "../../../scripts/release/preflight/checks.ts"
import { runPreflight } from "../../../scripts/release/preflight/preflight.ts"
import type { PreflightContext } from "../../../scripts/release/preflight/types.ts"
import { CONFIG, cleanupTempDirs, git, repoOnDevWithRemote } from "../helpers.ts"

afterEach(cleanupTempDirs)

const contextOf = (cwd: string): PreflightContext => ({ cwd, config: CONFIG, remote: "origin" })

describe("runPreflight", () => {
  it("reúne todos os problemas encontrados", () => {
    const repo = repoOnDevWithRemote()
    git(repo, "checkout", "-q", "main")
    writeFileSync(join(repo, "rascunho.txt"), "x")

    expect(runPreflight(contextOf(repo), [onDevelopBranch, cleanWorkingTree, noOpenRelease])).toHaveLength(2)
  })

  it("devolve lista vazia quando está tudo certo", () => {
    const repo = repoOnDevWithRemote()
    const checks = [
      onDevelopBranch,
      cleanWorkingTree,
      noOpenRelease,
      inSyncWithRemote("develop"),
      inSyncWithRemote("main"),
    ]

    expect(runPreflight(contextOf(repo), checks)).toEqual([])
  })
})
