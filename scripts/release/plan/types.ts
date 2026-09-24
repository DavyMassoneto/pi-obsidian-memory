import type { GitFlowConfig } from "../gitflow/types.ts"

export type StepId = "start" | "version" | "changelog" | "commit" | "finish" | "checkout" | "push"

interface StepBase {
  readonly id: StepId
  readonly title: string
  readonly recovery: string
}

export interface RunStep extends StepBase {
  readonly kind: "run"
  readonly command: string
  readonly args: readonly string[]
}

export interface SetVersionStep extends StepBase {
  readonly kind: "set-version"
  readonly version: string
}

export interface ChangelogStep extends StepBase {
  readonly kind: "changelog"
  readonly tag: string
}

export type Step = RunStep | SetVersionStep | ChangelogStep

export interface Release {
  readonly version: string
  readonly tag: string
  readonly branch: string
}

export interface ReleasePlan extends Release {
  readonly currentVersion: string
  readonly steps: readonly Step[]
}

export interface PlanInput {
  readonly config: GitFlowConfig
  readonly remote: string
  readonly currentVersion: string
  readonly nextVersion: string
  readonly releaseFiles: readonly string[]
}

export interface StepContext extends PlanInput {
  readonly release: Release
}

export type StepBuilder = (context: StepContext) => Step
