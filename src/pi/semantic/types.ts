import type { LocalSemantic } from "#src/usecases"

export interface ProviderAnswers {
  get(key: string): boolean | undefined
  set(key: string, answer: boolean): void
}

export interface LocalRuntimeState {
  semantic: LocalSemantic | null
}
