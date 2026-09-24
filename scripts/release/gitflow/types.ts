export interface GitFlowConfig {
  readonly main: string
  readonly develop: string
  readonly releasePrefix: string
  readonly tagPrefix: string
}

export interface BranchSetting {
  readonly branch: string
  readonly key: string
  readonly value: string
}

export type BranchSettings = Map<string, string>
