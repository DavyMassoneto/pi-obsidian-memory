import { describe, expect, it } from "vitest"

import { formatFailure, type Step } from "#scripts"

const start: Step = {
  id: "start",
  kind: "run",
  title: "Start release/0.2.0 from dev",
  command: "git",
  args: ["flow", "release", "start", "0.2.0"],
  recovery: "The base branches are untouched.",
}

const version: Step = {
  id: "version",
  kind: "set-version",
  title: "Set version 0.2.0 in package.json",
  version: "0.2.0",
  recovery: "Fix the problem and continue by hand.",
}

const changelog: Step = {
  id: "changelog",
  kind: "changelog",
  title: "Generate CHANGELOG.md",
  tag: "v0.2.0",
  recovery: "Abandon the release: git flow release delete --force 0.2.0",
}

describe("formatFailure", () => {
  it("shows what was already done, the error and how to continue", () => {
    const text = formatFailure(changelog, [start, version], new Error("disk full"))

    expect(text).toContain("Failed at: Generate CHANGELOG.md")
    expect(text).toContain("disk full")
    expect(text).toContain(`✔ ${start.title}`)
    expect(text).toContain(`✔ ${version.title}`)
    expect(text).toContain("git flow release delete --force 0.2.0")
  })

  it("lists no finished steps when the first one fails", () => {
    expect(formatFailure(start, [], new Error("no network"))).not.toContain("Already done")
  })
})
