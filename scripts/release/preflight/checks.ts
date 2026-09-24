import { git, readPackageVersion, tryGit } from "../index.ts"
import type { Check, PreflightContext, Problem } from "./types.ts"

export function gitFlowInstalled({ cwd }: PreflightContext): readonly Problem[] {
  if (tryGit(cwd, ["flow", "version"]).succeeded) return []
  return ["git-flow not found: install git-flow-next (winget install GitTower.GitFlowNext)"]
}

export function onDevelopBranch({ cwd, config }: PreflightContext): readonly Problem[] {
  const current = git(cwd, ["branch", "--show-current"])
  if (current === config.develop) return []
  if (current === "") return [`run the release from ${config.develop} (detached HEAD)`]
  return [`run the release from ${config.develop} (current branch: ${current})`]
}

export function cleanWorkingTree({ cwd }: PreflightContext): readonly Problem[] {
  if (git(cwd, ["status", "--porcelain"]) === "") return []
  return ["there are uncommitted changes"]
}

export function noOpenRelease({ cwd, config }: PreflightContext): readonly Problem[] {
  const open = git(cwd, ["branch", "--list", `${config.releasePrefix}*`, "--format=%(refname:short)"])
  if (open === "") return []
  return [`a release is already open (${open.split(/\r?\n/).join(", ")}): finish or delete it first`]
}

export function inSyncWithRemote(which: "main" | "develop"): Check {
  return ({ cwd, config, remote }) => {
    const branch = config[which]
    const local = tryGit(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`])
    if (!local.succeeded) return [`branch ${branch} does not exist locally`]
    const listing = tryGit(cwd, ["ls-remote", remote, `refs/heads/${branch}`])
    if (!listing.succeeded) return [`could not reach ${remote} (no network or no such remote)`]
    if (listing.output === "") return [`branch ${branch} does not exist on ${remote}`]
    if (listing.output.startsWith(local.output)) return []
    const shas = { local: local.output.slice(0, 7), remote: listing.output.slice(0, 7) }
    return [`local ${branch} (${shas.local}) differs from ${remote}/${branch} (${shas.remote}): sync first`]
  }
}

export function versionMatchesLatestTag({ cwd, config }: PreflightContext): readonly Problem[] {
  const latestTag = tryGit(cwd, ["describe", "--tags", "--abbrev=0", "--match", `${config.tagPrefix}[0-9]*`])
  if (!latestTag.succeeded) return []
  const version = readPackageVersion(cwd)
  if (latestTag.output === `${config.tagPrefix}${version}`) return []
  return [`package.json (${version}) does not match the latest tag (${latestTag.output})`]
}
