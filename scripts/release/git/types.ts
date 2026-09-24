export interface GitSuccess {
  readonly succeeded: true
  readonly output: string
}

export interface GitFailure {
  readonly succeeded: false
}

export type GitResult = GitSuccess | GitFailure
