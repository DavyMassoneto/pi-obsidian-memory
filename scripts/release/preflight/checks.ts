import { git, readPackageVersion, tryGit } from "../index.ts"
import type { Check, PreflightContext, Problem } from "./types.ts"

export function gitFlowInstalled({ cwd }: PreflightContext): Problem | undefined {
  if (tryGit(cwd, ["flow", "version"]) !== undefined) return undefined
  return "git-flow não encontrado: instale o git-flow-next (winget install GitTower.GitFlowNext)"
}

export function onDevelopBranch({ cwd, config }: PreflightContext): Problem | undefined {
  const current = git(cwd, ["branch", "--show-current"])
  if (current === config.develop) return undefined
  if (current === "") return `rode o release a partir da ${config.develop} (HEAD destacado)`
  return `rode o release a partir da ${config.develop} (branch atual: ${current})`
}

export function cleanWorkingTree({ cwd }: PreflightContext): Problem | undefined {
  if (git(cwd, ["status", "--porcelain"]) === "") return undefined
  return "há mudanças não commitadas"
}

export function noOpenRelease({ cwd, config }: PreflightContext): Problem | undefined {
  const open = git(cwd, ["branch", "--list", `${config.releasePrefix}*`, "--format=%(refname:short)"])
  if (open === "") return undefined
  return `já existe release aberta (${open.split(/\r?\n/).join(", ")}): termine ou apague antes`
}

export function inSyncWithRemote(which: "main" | "develop"): Check {
  return ({ cwd, config, remote }) => {
    const branch = config[which]
    const local = tryGit(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`])
    if (local === undefined) return `a branch ${branch} não existe localmente`
    const listing = tryGit(cwd, ["ls-remote", remote, `refs/heads/${branch}`])
    if (listing === undefined) return `não foi possível consultar ${remote} (sem rede ou remoto inexistente)`
    const remoteSha = listing.split(/\s+/)[0]
    if (!remoteSha) return `a branch ${branch} não existe em ${remote}`
    if (local === remoteSha) return undefined
    return `${branch} local (${local.slice(0, 7)}) difere de ${remote}/${branch} (${remoteSha.slice(0, 7)}): sincronize antes`
  }
}

export function versionMatchesLatestTag({ cwd, config }: PreflightContext): Problem | undefined {
  const tag = tryGit(cwd, ["describe", "--tags", "--abbrev=0", "--match", `${config.tagPrefix}[0-9]*`])
  if (tag === undefined) return undefined
  const version = readPackageVersion(cwd)
  if (tag === `${config.tagPrefix}${version}`) return undefined
  return `o package.json (${version}) não bate com a última tag (${tag})`
}
