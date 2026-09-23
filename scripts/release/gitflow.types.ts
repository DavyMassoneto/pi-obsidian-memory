export interface GitFlowConfig {
  readonly main: string
  readonly develop: string
  readonly releasePrefix: string
  readonly tagPrefix: string
}

export type BranchSettings = Map<string, string>
