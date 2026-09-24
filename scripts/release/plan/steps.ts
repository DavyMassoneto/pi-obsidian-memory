import type { Step, StepContext } from "./types.ts"

export function startStep(context: StepContext): Step {
  const { config, release } = context
  return {
    id: "start",
    kind: "run",
    title: `Start ${release.branch} from ${config.develop}`,
    command: "git",
    args: ["flow", "release", "start", release.version],
    recovery: `The base branches are untouched. If ${release.branch} was created: ${abandonCommand(context)}`,
  }
}

export function versionStep(context: StepContext): Step {
  const { version } = context.release
  return {
    id: "version",
    kind: "set-version",
    title: `Set version ${version} in package.json`,
    version,
    recovery: insideReleaseRecovery(context),
  }
}

export function changelogStep(context: StepContext): Step {
  return {
    id: "changelog",
    kind: "changelog",
    title: "Generate CHANGELOG.md",
    tag: context.release.tag,
    recovery: insideReleaseRecovery(context),
  }
}

export function commitStep(context: StepContext): Step {
  const message = `chore(release): ${context.release.tag}`
  return {
    id: "commit",
    kind: "run",
    title: `Commit "${message}"`,
    command: "git",
    args: ["commit", "-m", message, "--", ...context.releaseFiles],
    recovery: insideReleaseRecovery(context),
  }
}

export function finishStep({ config, release }: StepContext): Step {
  const args = ["flow", "release", "finish", release.version, "--message", release.tag, "--no-push"]
  return {
    id: "finish",
    kind: "run",
    title: `Finish the release: merge into ${config.main}, tag ${release.tag} and merge back into ${config.develop}`,
    command: "git",
    args,
    recovery: `If it stopped on a merge conflict: resolve it, git add and run again: git ${args.join(" ")}`,
  }
}

// git flow release finish ends on the production branch; work continues on the integration branch.
export function checkoutStep(context: StepContext): Step {
  const { develop } = context.config
  const push = `git ${pushArgs(context).join(" ")}`
  return {
    id: "checkout",
    kind: "run",
    title: `Switch back to ${develop}`,
    command: "git",
    args: ["checkout", develop],
    recovery: `The release is complete locally. Run git checkout ${develop} and push: ${push}`,
  }
}

export function pushStep(context: StepContext): Step {
  const { config, release, remote } = context
  const args = pushArgs(context)
  return {
    id: "push",
    kind: "run",
    title: `Push ${config.main}, ${config.develop} and ${release.tag} to ${remote}`,
    command: "git",
    args,
    recovery: `The release is complete locally; only the push is missing: git ${args.join(" ")}`,
  }
}

function pushArgs({ config, release, remote }: StepContext): string[] {
  return ["push", "--atomic", remote, config.main, config.develop, release.tag]
}

function abandonCommand({ config, release }: StepContext): string {
  return `git checkout ${config.develop} && git flow release delete --force ${release.version}`
}

function insideReleaseRecovery(context: StepContext): string {
  return (
    `You are on ${context.release.branch}. Fix the problem and continue by hand from this step, ` +
    `or abandon the release: ${abandonCommand(context)}`
  )
}
