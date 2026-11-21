import type { Failed, Succeeded } from "#src/shared"

export interface OmSource {
  path: string
  text: string
}

export interface OmMemoryRefusal extends Failed {
  reason: "io-error"
}

export type OmMemoryResult = Succeeded<OmSource[]> | OmMemoryRefusal

export interface ReadProblem extends Failed {
  reason: "not-found" | "io-error"
}

export type GuardedRead<Output> = Succeeded<Output> | ReadProblem

export type ReadAction<Output> = () => Promise<Output>
