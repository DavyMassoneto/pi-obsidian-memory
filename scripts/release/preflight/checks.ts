import { git, readPackageVersion, tryGit } from "../index.ts"
import type { Check, PreflightContext, Problem } from "./types.ts"

export function gitFlowInstalled({ cwd }: PreflightContext): readonly Problem[] {
  if (tryGit(cwd, ["flow", "version"]).succeeded) return []
  return ["git-flow não encontrado: instale o git-flow-next (winget install GitTower.GitFlowNext)"]
}

export function onDevelopBranch({ cwd, config }: PreflightContext): readonly Problem[] {
  const current = git(cwd, ["branch", "--show-current"])
  if (current === config.develop) return []
  if (current === "") return [`rode o release a partir da ${config.develop} (HEAD destacado)`]
  return [`rode o release a partir da ${config.develop} (branch atual: ${current})`]
}

export function cleanWorkingTree({ cwd }: PreflightContext): readonly Problem[] {
  if (git(cwd, ["status", "--porcelain"]) === "") return []
  return ["há mudanças não commitadas"]
}

export function noOpenRelease({ cwd, config }: PreflightContext): readonly Problem[] {
  const open = git(cwd, ["branch", "--list", `${config.releasePrefix}*`, "--format=%(refname:short)"])
  if (open === "") return []
  return [`já existe release aberta (${open.split(/\r?\n/).join(", ")}): termine ou apague antes`]
}

export function inSyncWithRemote(which: "main" | "develop"): Check {
  return ({ cwd, config, remote }) => {
    const branch = config[which]
    const local = tryGit(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`])
    if (!local.succeeded) return [`a branch ${branch} não existe localmente`]
    const listing = tryGit(cwd, ["ls-remote", remote, `refs/heads/${branch}`])
    if (!listing.succeeded) return [`não foi possível consultar ${remote} (sem rede ou remoto inexistente)`]
    if (listing.output === "") return [`a branch ${branch} não existe em ${remote}`]
    if (listing.output.startsWith(local.output)) return []
    const shas = { local: local.output.slice(0, 7), remote: listing.output.slice(0, 7) }
    return [`${branch} local (${shas.local}) difere de ${remote}/${branch} (${shas.remote}): sincronize antes`]
  }
}

export function versionMatchesLatestTag({ cwd, config }: PreflightContext): readonly Problem[] {
  const latestTag = tryGit(cwd, ["describe", "--tags", "--abbrev=0", "--match", `${config.tagPrefix}[0-9]*`])
  if (!latestTag.succeeded) return []
  const version = readPackageVersion(cwd)
  if (latestTag.output === `${config.tagPrefix}${version}`) return []
  return [`o package.json (${version}) não bate com a última tag (${latestTag.output})`]
}
