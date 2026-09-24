import { afterEach, describe, expect, it } from "vitest"

import { git, runVisible, tryGit } from "#scripts"
import { cleanupTempDirs, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

describe("git", () => {
  it("returns the output without surrounding whitespace", () => {
    const dir = tempDir()
    git(dir, ["init", "-q", "-b", "dev"])

    expect(git(dir, ["branch", "--show-current"])).toBe("dev")
  })

  it("includes the command and its error output on failure", () => {
    expect(() => git(tempDir(), ["rev-parse", "HEAD"])).toThrow(/git rev-parse HEAD failed: \S/)
  })
})

describe("tryGit", () => {
  it("returns the output when the command succeeds", () => {
    const dir = tempDir()
    git(dir, ["init", "-q", "-b", "dev"])

    expect(tryGit(dir, ["branch", "--show-current"])).toEqual({ succeeded: true, output: "dev" })
  })

  it("reports when the command fails", () => {
    expect(tryGit(tempDir(), ["rev-parse", "HEAD"])).toEqual({ succeeded: false })
  })
})

describe("runVisible", () => {
  it("reports the exit code", () => {
    expect(() => runVisible(tempDir(), process.execPath, ["-e", "process.exit(3)"])).toThrow(/exited with code 3/)
  })

  it("reports a missing command", () => {
    expect(() => runVisible(tempDir(), "missing-command", [])).toThrow(/missing-command failed: .*ENOENT/)
  })
})
