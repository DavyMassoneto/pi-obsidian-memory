import type { Bump } from "./version.types.ts"

export interface ReleaseOptions {
  readonly dryRun: boolean
  readonly yes: boolean
  readonly bump: Bump
}
