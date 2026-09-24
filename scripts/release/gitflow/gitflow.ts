import { existsSync } from "node:fs"
import { join } from "node:path"

import { git } from "../index.ts"
import { BRANCH_SETTING, GITFLOW_FILE } from "./constants.ts"
import type { BranchSetting, BranchSettings, GitFlowConfig } from "./types.ts"

export function readGitFlowConfig(cwd: string): GitFlowConfig {
  const file = join(cwd, GITFLOW_FILE)
  if (!existsSync(file)) throw new Error(`${GITFLOW_FILE} não encontrado em ${cwd}: rode "git flow init --shared"`)
  return parseGitFlowConfig(git(cwd, ["config", "--file", file, "--list"]))
}

export function parseGitFlowConfig(listing: string): GitFlowConfig {
  const branches = readBranches(listing)
  const main = findBranch(branches, "base sem pai (a de produção)", (settings) => {
    return isBase(settings) && !settings.has("parent")
  })
  const develop = findBranch(branches, `base filha de ${main} (a de integração)`, (settings) => {
    return isBase(settings) && settings.get("parent") === main
  })
  const release = branches.get("release")
  if (release === undefined) throw new Error(`${GITFLOW_FILE}: prefixo das branches de release não configurado`)
  return {
    main,
    develop,
    releasePrefix: requiredSetting(release, "prefix", "prefixo das branches de release"),
    tagPrefix: requiredSetting(release, "tagprefix", "prefixo das tags de versão"),
  }
}

function readBranches(listing: string): Map<string, BranchSettings> {
  const settings = listing.split(/\r?\n/).flatMap(parseBranchSetting)
  const branches = new Map<string, BranchSettings>()
  for (const [branch, entries] of Map.groupBy(settings, (setting) => setting.branch)) {
    branches.set(branch, new Map(entries.map((entry) => [entry.key, entry.value])))
  }
  return branches
}

function parseBranchSetting(line: string): BranchSetting[] {
  const match = BRANCH_SETTING.exec(line)
  if (match === null) return []
  const [, branch, key, value] = match
  if (branch === undefined || key === undefined || value === undefined) return []
  return [{ branch, key: key.toLowerCase(), value }]
}

function findBranch(
  branches: Map<string, BranchSettings>,
  description: string,
  matches: (settings: BranchSettings) => boolean,
): string {
  for (const [name, settings] of branches) {
    if (matches(settings)) return name
  }
  throw new Error(`${GITFLOW_FILE}: nenhuma branch ${description}`)
}

function isBase(settings: BranchSettings): boolean {
  return settings.get("type") === "base"
}

function requiredSetting(settings: BranchSettings, key: string, description: string): string {
  const value = settings.get(key)
  if (value === undefined) throw new Error(`${GITFLOW_FILE}: ${description} não configurado`)
  return value
}
