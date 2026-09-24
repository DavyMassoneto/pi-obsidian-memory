import { copyFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { parseGitFlowConfig, readGitFlowConfig } from "#scripts"
import { CONFIG, cleanupTempDirs, REPO_ROOT, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

describe("readGitFlowConfig", () => {
  it("reads this project's .gitflow", () => {
    const dir = tempDir()
    copyFileSync(join(REPO_ROOT, ".gitflow"), join(dir, ".gitflow"))

    expect(readGitFlowConfig(dir)).toEqual(CONFIG)
  })

  it("explains what to do when there is no .gitflow", () => {
    expect(() => readGitFlowConfig(tempDir())).toThrow(/git flow init --shared/)
  })
})

describe("parseGitFlowConfig", () => {
  const listing = (lines: string[]) => lines.join("\n")

  it("identifies production and integration by hierarchy, not by name", () => {
    const config = parseGitFlowConfig(
      listing([
        "gitflow.branch.trunk.type=base",
        "gitflow.branch.integration.type=base",
        "gitflow.branch.integration.parent=trunk",
        "gitflow.branch.release.type=topic",
        "gitflow.branch.release.prefix=rel/",
        "gitflow.branch.release.tagprefix=r",
      ]),
    )

    expect(config).toEqual({ main: "trunk", develop: "integration", releasePrefix: "rel/", tagPrefix: "r" })
  })

  it("accepts CRLF line endings", () => {
    const config = parseGitFlowConfig(
      "gitflow.branch.main.type=base\r\ngitflow.branch.dev.type=base\r\ngitflow.branch.dev.parent=main\r\ngitflow.branch.release.prefix=release/\r\ngitflow.branch.release.tagprefix=v\r\n",
    )

    expect(config).toEqual(CONFIG)
  })

  it("rejects a configuration without an integration branch", () => {
    expect(() =>
      parseGitFlowConfig(listing(["gitflow.branch.main.type=base", "gitflow.branch.release.prefix=release/"])),
    ).toThrow(/integration/)
  })

  it("rejects a configuration without a release prefix", () => {
    expect(() =>
      parseGitFlowConfig(
        listing(["gitflow.branch.main.type=base", "gitflow.branch.dev.type=base", "gitflow.branch.dev.parent=main"]),
      ),
    ).toThrow(/\.gitflow release branch settings is not in the expected format: .*prefix/)
  })

  it("rejects a configuration without a tag prefix", () => {
    expect(() =>
      parseGitFlowConfig(
        listing([
          "gitflow.branch.main.type=base",
          "gitflow.branch.dev.type=base",
          "gitflow.branch.dev.parent=main",
          "gitflow.branch.release.prefix=release/",
        ]),
      ),
    ).toThrow(/\.gitflow release branch settings is not in the expected format: .*tagprefix/)
  })
})
