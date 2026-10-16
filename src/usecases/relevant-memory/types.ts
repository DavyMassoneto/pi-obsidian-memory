import type { Static } from "typebox"

import type {
  AgentContext,
  ChatModelReference,
  CompletionPort,
  JevClassifierPort,
  ReadObservation,
  RetrievalAction,
} from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"
import type { LoadedChangesSchema } from "./schemas.ts"

export type { BoolQuestion, DecisionPrompt } from "#src/services"

export interface JevAccess {
  available: true
  classifier: JevClassifierPort
}

export interface JevRefusal {
  available: false
  reason: string
}

export type JevSource = (model: string) => Promise<JevAccess | JevRefusal>

export interface LoadedStore {
  all(): ReadObservation[]
  has(note: ReadObservation): boolean
  remember(note: ReadObservation): void
  forget(note: ReadObservation): void
  apply(changes: LoadedChanges): void
}

export interface RetrieveDeps {
  complete: CompletionPort
  jev: JevSource
  loaded: LoadedStore
}

export interface SessionMemoryDeps {
  complete: CompletionPort
  loaded: LoadedStore
}

export interface RetrieveRequest {
  message: string
}

export type LoadedChanges = Static<typeof LoadedChangesSchema>

export interface RetrievedMemory {
  text: string | null
  notices: string[]
  changes: LoadedChanges
}

export type CutoffSource = "config" | "typesafe" | "missing"

export interface CutoffValue {
  value: number | null
  source: CutoffSource
}

export interface CutoffReport {
  gate: CutoffValue
  relevance: CutoffValue
}

export interface Refreshed {
  blocks: string[]
  changes: LoadedChanges
}

export type RetrieveMemoryResult = Succeeded<RetrievedMemory> | MemoryResolutionRefusal

export interface AgentFound {
  succeeded: true
  output: ReadObservation[]
}

export interface AgentFailed {
  succeeded: false
  notice: string | null
}

export type AgentOutcome = AgentFound | AgentFailed

export interface AgentRequest {
  agent: AgentContext
  query: string
  model: ChatModelReference
  deadline: number
}

export interface FinishDiscriminant {
  action: "finish"
}

export type ReadStep = Exclude<RetrievalAction, FinishDiscriminant>

export interface RankedNotes {
  notes: ReadObservation[]
  notice: string | null
}
