import { existsSync } from "node:fs"
import { join } from "node:path"

import { git } from "../git/git.ts"
import { BRANCH_SETTING, GITFLOW_FILE } from "./constants.ts"
import type { BranchSettings, GitFlowConfig } from "./types.ts"

export function readGitFlowConfig(cwd: string): GitFlowConfig {
  const file = join(cwd, GITFLOW_FILE)
  if (!existsSync(file)) throw new Error(`${GITFLOW_FILE} não encontrado em ${cwd}: rode "git flow init --shared"`)
  return parseGitFlowConfig(git(cwd, ["config", "--file", file, "--list"]))
}

export function parseGitFlowConfig(listing: string): GitFlowConfig {
  const branches = readBranches(listing)
  const bases = [...branches].filter(([, settings]) => settings.get("type") === "base")
  const main = bases.find(([, settings]) => !settings.has("parent"))?.[0]
  if (main === undefined) throw new Error(`${GITFLOW_FILE}: nenhuma branch base sem pai (a de produção)`)
  const develop = bases.find(([, settings]) => settings.get("parent") === main)?.[0]
  if (develop === undefined) throw new Error(`${GITFLOW_FILE}: nenhuma branch base filha de ${main} (a de integração)`)
  const release = branches.get("release")
  const releasePrefix = release?.get("prefix")
  if (releasePrefix === undefined) throw new Error(`${GITFLOW_FILE}: prefixo das branches de release não configurado`)
  return { main, develop, releasePrefix, tagPrefix: release?.get("tagprefix") ?? "" }
}

function readBranches(listing: string): Map<string, BranchSettings> {
  const branches = new Map<string, BranchSettings>()
  for (const line of listing.split(/\r?\n/)) {
    const setting = BRANCH_SETTING.exec(line)?.groups
    if (setting?.name === undefined || setting.key === undefined || setting.value === undefined) continue
    const settings = branches.get(setting.name) ?? new Map<string, string>()
    settings.set(setting.key.toLowerCase(), setting.value)
    branches.set(setting.name, settings)
  }
  return branches
}
