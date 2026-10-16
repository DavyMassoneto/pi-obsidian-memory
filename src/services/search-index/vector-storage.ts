import { Value } from "typebox/value"

import { type VectorChunk, type VectorGeneration, VectorGenerationSchema, type VectorReplacement } from "#src/domain"
import type { Succeeded } from "#src/shared"
import type { prepareCatalogStatements } from "./catalog-statements.ts"
import { corruptCatalog } from "./inventory.ts"
import { invalidCatalog, staleCatalog } from "./reconcile.ts"
import {
  CatalogStateSchema,
  VectorChunkSchema,
  VectorReplacementSchema,
  VectorRowSchema,
  VectorUpdateSchema,
  VectorValuesSchema,
} from "./schemas.ts"
import type {
  IndexWriteResult,
  SearchIndexRefusal,
  VectorCacheResult,
  VectorCoverageResult,
  VectorUpdate,
} from "./types.ts"
import type { prepareVectorStatements } from "./vector-statements.ts"

export function readVectors(statements: ReturnType<typeof prepareVectorStatements>): VectorCacheResult {
  const generation = statements.generation.get()
  const rows = statements.chunks.all()
  if (!generation) {
    if (rows.length > 0) return corruptCatalog()
    return { succeeded: true, output: { generation: null, chunks: [] } }
  }
  if (!Value.Check(VectorGenerationSchema, generation)) return corruptCatalog()
  const chunks: VectorChunk[] = []
  for (const row of rows) {
    if (!Value.Check(VectorRowSchema, row)) return corruptCatalog()
    const vector = JSON.parse(row.vector)
    if (!Value.Check(VectorValuesSchema, vector)) return corruptCatalog()
    const chunk = { contentFingerprint: row.content_fingerprint, chunk: row.chunk, vector }
    if (!Value.Check(VectorChunkSchema, chunk) || !validVector(chunk.vector, generation.dimensions)) {
      return corruptCatalog()
    }
    chunks.push(chunk)
  }
  if (!contiguousChunks(chunks)) return corruptCatalog()
  return { succeeded: true, output: { generation, chunks } }
}

export function writeVectors(
  statements: ReturnType<typeof prepareVectorStatements>,
  catalog: ReturnType<typeof prepareCatalogStatements>,
  request: VectorReplacement,
): IndexWriteResult {
  if (!Value.Check(VectorReplacementSchema, request)) return invalidCatalog("invalid vector generation")
  const current = readCurrentContent(statements, catalog, request.expectedRevision)
  if (!current.succeeded) return current
  if (!usableChunks(request.chunks, request.generation, current.output)) {
    return invalidCatalog("vectors must belong to current content with finite nonzero vectors of one dimension")
  }

  statements.clearChunks.run()
  statements.clearGeneration.run()
  statements.putGeneration.run(request.generation.fingerprint, request.generation.dimensions)
  for (const chunk of request.chunks) putChunk(statements, chunk)
  return { succeeded: true }
}

export function updateVectors(
  statements: ReturnType<typeof prepareVectorStatements>,
  catalog: ReturnType<typeof prepareCatalogStatements>,
  request: VectorUpdate,
): IndexWriteResult {
  if (!Value.Check(VectorUpdateSchema, request)) return invalidCatalog("invalid vector update")
  const current = readCurrentContent(statements, catalog, request.expectedRevision)
  if (!current.succeeded) return current
  const added = new Set(request.add.map((chunk) => chunk.contentFingerprint))
  if (
    !usableChunks(request.add, request.generation, current.output) ||
    request.remove.some((entry) => added.has(entry))
  ) {
    return invalidCatalog("added vectors must belong to current content, be finite, nonzero and not also removed")
  }
  const stored = readGeneration(statements)
  if (!stored.succeeded) return stored
  if (!sameGeneration(stored.output, request.generation)) {
    statements.clearChunks.run()
    statements.clearGeneration.run()
    statements.putGeneration.run(request.generation.fingerprint, request.generation.dimensions)
  }

  for (const fingerprint of [...request.remove, ...added]) statements.removeChunks.run(fingerprint)
  for (const chunk of request.add) putChunk(statements, chunk)
  return { succeeded: true }
}

export function readVectorCoverage(statements: ReturnType<typeof prepareVectorStatements>): VectorCoverageResult {
  const generation = readGeneration(statements)
  if (!generation.succeeded) return generation
  const embedded = statements.embeddedContent.get()
  if (!embedded || typeof embedded.embedded !== "number") return corruptCatalog()
  const current = readFingerprints(statements)
  if (!current.succeeded) return current
  return {
    succeeded: true,
    output: { generation: generation.output, embedded: embedded.embedded, current: current.output.size },
  }
}

function readGeneration(
  statements: ReturnType<typeof prepareVectorStatements>,
): Succeeded<VectorGeneration | null> | SearchIndexRefusal {
  const row = statements.generation.get()
  if (!row) return { succeeded: true, output: null }
  if (!Value.Check(VectorGenerationSchema, row)) return corruptCatalog()
  return { succeeded: true, output: row }
}

function readCurrentContent(
  statements: ReturnType<typeof prepareVectorStatements>,
  catalog: ReturnType<typeof prepareCatalogStatements>,
  expectedRevision: number,
): Succeeded<Set<string>> | SearchIndexRefusal {
  const state = catalog.state.get()
  if (!Value.Check(CatalogStateSchema, state)) return corruptCatalog()
  if (state.revision !== expectedRevision) return staleCatalog()
  return readFingerprints(statements)
}

function readFingerprints(
  statements: ReturnType<typeof prepareVectorStatements>,
): Succeeded<Set<string>> | SearchIndexRefusal {
  const fingerprints = new Set<string>()
  for (const row of statements.currentContent.all()) {
    if (typeof row.content_fingerprint !== "string") return corruptCatalog()
    fingerprints.add(row.content_fingerprint)
  }
  return { succeeded: true, output: fingerprints }
}

function sameGeneration(stored: VectorGeneration | null, requested: VectorGeneration): boolean {
  return stored?.fingerprint === requested.fingerprint && stored.dimensions === requested.dimensions
}

function putChunk(statements: ReturnType<typeof prepareVectorStatements>, chunk: VectorChunk): void {
  statements.putChunk.run(chunk.contentFingerprint, chunk.chunk, JSON.stringify(chunk.vector))
}

function usableChunks(chunks: VectorChunk[], generation: VectorGeneration, current: Set<string>): boolean {
  return (
    chunks.every(
      (chunk) => current.has(chunk.contentFingerprint) && validVector(chunk.vector, generation.dimensions),
    ) && contiguousChunks(chunks)
  )
}

function contiguousChunks(chunks: VectorChunk[]): boolean {
  const groups = new Map<string, number[]>()
  for (const chunk of chunks) {
    const group = groups.get(chunk.contentFingerprint)
    if (group) group.push(chunk.chunk)
    else groups.set(chunk.contentFingerprint, [chunk.chunk])
  }
  return [...groups.values()].every((group) =>
    group.sort((left, right) => left - right).every((chunk, index) => chunk === index),
  )
}

function validVector(vector: number[], dimensions: number): boolean {
  return vector.length === dimensions && vector.every(Number.isFinite) && vector.some((value) => value !== 0)
}
