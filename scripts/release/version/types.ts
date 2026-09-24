import type { BUMPS } from "./constants.ts"

export type Bump = (typeof BUMPS)[number]

export type Version = readonly [major: number, minor: number, patch: number]
