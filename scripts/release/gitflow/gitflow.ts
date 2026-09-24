import { existsSync } from "node:fs"
import { join } from "node:path"

import { git, parseValue } from "../index.ts"
import { BRANCH_SETTING, GITFLOW_FILE } from "./constants.ts"
import { BranchSettingSchema, ReleaseBranchSchema } from "./schemas.ts"
import type { BranchSetting, GitFlowConfig } from "./types.ts"

export function readGitFlowConfig(cwd: string): GitFlowConfig {
  const file = join(cwd, GITFLOW_FILE)
  if (!existsSync(file)) throw new Error(`${GITFLOW_FILE} not found in ${cwd}: run "git flow init --shared"`)
  return parseGitFlowConfig(git(cwd, ["config", "--file", file, "--list"]))
}

export function parseGitFlowConfig(listing: string): GitFlowConfig {
  const settings = listing.split(/\r?\n/).flatMap(parseBranchSetting)
  const main = findBranch(settings, "base branch without a parent (production)", (branch) => {
    return isBase(settings, branch) && !hasSetting(settings, branch, "parent")
  })
  const develop = findBranch(settings, `base branch whose parent is ${main} (integration)`, (branch) => {
    return isBase(settings, branch) && hasSettingValue(settings, branch, "parent", main)
  })
  const release = parseValue(
    ReleaseBranchSchema,
    settingsOf(settings, "release"),
    `${GITFLOW_FILE} release branch settings`,
  )
  return { main, develop, releasePrefix: release.prefix, tagPrefix: release.tagprefix }
}

function parseBranchSetting(line: string): BranchSetting[] {
  const match = BRANCH_SETTING.exec(line)
  if (!match) return []
  return [parseValue(BranchSettingSchema, match.groups, `${GITFLOW_FILE}: ${line}`)]
}

function findBranch(
  settings: readonly BranchSetting[],
  description: string,
  matches: (branch: string) => boolean,
): string {
  for (const branch of new Set(settings.map((setting) => setting.branch))) {
    if (matches(branch)) return branch
  }
  throw new Error(`${GITFLOW_FILE}: found no ${description}`)
}

function isBase(settings: readonly BranchSetting[], branch: string): boolean {
  return hasSettingValue(settings, branch, "type", "base")
}

function hasSetting(settings: readonly BranchSetting[], branch: string, key: string): boolean {
  return settings.some((setting) => setting.branch === branch && setting.key === key)
}

function hasSettingValue(settings: readonly BranchSetting[], branch: string, key: string, value: string): boolean {
  return settings.some((setting) => setting.branch === branch && setting.key === key && setting.value === value)
}

function settingsOf(settings: readonly BranchSetting[], branch: string) {
  const entries = settings.filter((setting) => setting.branch === branch).map((setting) => [setting.key, setting.value])
  return Object.fromEntries(entries)
}
