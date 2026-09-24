import type { Bump } from "../index.ts"

export interface ReleaseOptions {
  readonly dryRun: boolean
  readonly yes: boolean
  readonly bump: Bump
}
