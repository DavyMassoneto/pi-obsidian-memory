import type { Static } from "typebox"

import type { BranchSettingSchema } from "./schemas.ts"

export interface GitFlowConfig {
  readonly main: string
  readonly develop: string
  readonly releasePrefix: string
  readonly tagPrefix: string
}

export type BranchSetting = Static<typeof BranchSettingSchema>
