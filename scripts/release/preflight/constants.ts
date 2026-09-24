import {
  cleanWorkingTree,
  gitFlowInstalled,
  inSyncWithRemote,
  noOpenRelease,
  onDevelopBranch,
  versionMatchesLatestTag,
} from "./checks.ts"
import type { Check } from "./types.ts"

export const CHECKS: readonly Check[] = [
  gitFlowInstalled,
  onDevelopBranch,
  cleanWorkingTree,
  noOpenRelease,
  inSyncWithRemote("develop"),
  inSyncWithRemote("main"),
  versionMatchesLatestTag,
]
