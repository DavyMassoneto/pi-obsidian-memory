import type { GitFlowConfig } from "../index.ts"

export interface PreflightContext {
  readonly cwd: string
  readonly config: GitFlowConfig
  readonly remote: string
}

export type Problem = string

export type Check = (context: PreflightContext) => Problem | undefined
