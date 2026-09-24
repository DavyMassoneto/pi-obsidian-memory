import { compareVersions } from "../version/version.ts"
import { STEPS } from "./constants.ts"
import { NothingToRelease } from "./errors.ts"
import type { PlanInput, Release, ReleasePlan, StepContext } from "./types.ts"

export function buildPlan(input: PlanInput): ReleasePlan {
  const { config, currentVersion, nextVersion } = input
  if (compareVersions(nextVersion, currentVersion) <= 0) throw new NothingToRelease(currentVersion, nextVersion)
  const release: Release = {
    version: nextVersion,
    tag: `${config.tagPrefix}${nextVersion}`,
    branch: `${config.releasePrefix}${nextVersion}`,
  }
  const context: StepContext = { ...input, release }
  return { ...release, currentVersion, steps: STEPS.map((build) => build(context)) }
}
