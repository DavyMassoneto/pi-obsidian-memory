import { describe, expect, it } from "vitest"

import type { PlanInput, ReleasePlan, Step, StepId } from "#scripts"
import { buildPlan, NothingToRelease } from "#scripts"
import { CONFIG } from "../helpers.ts"

const input: PlanInput = {
  config: CONFIG,
  remote: "origin",
  currentVersion: "0.1.0",
  nextVersion: "0.2.0",
  releaseFiles: ["package.json", "package-lock.json", "CHANGELOG.md"],
}

function stepOf(plan: ReleasePlan, id: StepId): Step | undefined {
  return plan.steps.find((step) => step.id === id)
}

describe("buildPlan", () => {
  it("follows the Git Flow order", () => {
    expect(buildPlan(input).steps.map((step) => step.id)).toEqual([
      "start",
      "version",
      "changelog",
      "commit",
      "finish",
      "checkout",
      "push",
    ])
  })

  it("ends on the integration branch, not on the production one", () => {
    expect(stepOf(buildPlan(input), "checkout")).toMatchObject({ kind: "run", args: ["checkout", "dev"] })
  })

  it("uses the .gitflow prefixes for the branch and the tag", () => {
    const plan = buildPlan(input)

    expect(plan.branch).toBe("release/0.2.0")
    expect(plan.tag).toBe("v0.2.0")
    expect(stepOf(plan, "start")).toMatchObject({ kind: "run", args: ["flow", "release", "start", "0.2.0"] })
  })

  it("commits only the release files", () => {
    expect(stepOf(buildPlan(input), "commit")).toMatchObject({
      kind: "run",
      args: ["commit", "-m", "chore(release): v0.2.0", "--", "package.json", "package-lock.json", "CHANGELOG.md"],
    })
  })

  it("finishes with the tag message and without pushing", () => {
    expect(stepOf(buildPlan(input), "finish")).toMatchObject({
      kind: "run",
      args: ["flow", "release", "finish", "0.2.0", "--message", "v0.2.0", "--no-push"],
    })
  })

  it("pushes main, dev and the tag atomically", () => {
    expect(stepOf(buildPlan(input), "push")).toMatchObject({
      kind: "run",
      args: ["push", "--atomic", "origin", "main", "dev", "v0.2.0"],
    })
  })

  it("gives recovery instructions for every step", () => {
    for (const step of buildPlan(input).steps) expect(step.recovery.length).toBeGreaterThan(20)
  })

  it.each(["0.1.0", "0.0.9"])(
    "refuses when the next version (%s) is not greater than the current one",
    (nextVersion) => {
      expect(() => buildPlan({ ...input, nextVersion })).toThrow(NothingToRelease)
    },
  )

  it("rejects invalid versions", () => {
    expect(() => buildPlan({ ...input, nextVersion: "0.2" })).toThrow(/invalid version/)
  })
})
