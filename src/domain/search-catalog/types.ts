import type { Static } from "typebox"

import type { CatalogEntrySchema, CatalogStatSchema, VectorGenerationSchema } from "./schemas.ts"

export type CatalogEntry = Static<typeof CatalogEntrySchema>
export type CatalogStat = Static<typeof CatalogStatSchema>
export type VectorGeneration = Static<typeof VectorGenerationSchema>
export type CatalogPopulation = "needs-population" | "ready"

export interface CatalogSnapshot {
  entries: CatalogEntry[]
  population: CatalogPopulation
  revision: number
}

export interface CatalogScan {
  entries: CatalogEntry[]
  observedPaths: string[]
  completeDirectories: string[]
  failedPaths: string[]
  validationFingerprint: string
  complete: boolean
}

export interface CatalogStatUpdate {
  path: string
  stat: CatalogStat
}

export interface CatalogChanges {
  expectedRevision: number
  upserts: CatalogEntry[]
  deletes: string[]
  statUpdates: CatalogStatUpdate[]
  population: CatalogPopulation
}

export interface DuplicateCatalogId {
  id: string
  paths: string[]
}

export interface CatalogPlan extends CatalogChanges {
  duplicateIds: DuplicateCatalogId[]
  reinspectPaths: string[]
  touchedFolders: string[]
}

export interface SemanticContent {
  statement: string
  body: string
}

export interface VectorChunk {
  contentFingerprint: string
  chunk: number
  vector: number[]
}

export interface VectorCache {
  generation: VectorGeneration | null
  chunks: VectorChunk[]
}

export interface VectorReplacement {
  expectedRevision: number
  generation: VectorGeneration
  chunks: VectorChunk[]
}
