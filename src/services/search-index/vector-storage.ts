import { Value } from "typebox/value"

import { type CatalogSnapshot, type VectorChunk, VectorGenerationSchema, type VectorReplacement } from "#/domain"
import type { prepareCatalogStatements } from "./catalog-statements.ts"
import { corruptCatalog, readInventory } from "./inventory.ts"
import { invalidCatalog, staleCatalog } from "./reconcile.ts"
import { VectorChunkSchema, VectorReplacementSchema, VectorRowSchema, VectorValuesSchema } from "./schemas.ts"
import type { IndexWriteResult, VectorCacheResult } from "./types.ts"
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
  const inventory = readInventory(catalog)
  if (!inventory.succeeded) return inventory
  if (inventory.output.revision !== request.expectedRevision) return staleCatalog()
  if (!completeVectors(request, inventory.output)) {
    return invalidCatalog("vectors must cover current content with finite nonzero vectors of one dimension")
  }

  statements.clearChunks.run()
  statements.clearGeneration.run()
  statements.putGeneration.run(request.generation.fingerprint, request.generation.dimensions)
  for (const chunk of request.chunks) {
    statements.putChunk.run(chunk.contentFingerprint, chunk.chunk, JSON.stringify(chunk.vector))
  }
  return { succeeded: true }
}

function completeVectors(request: VectorReplacement, inventory: CatalogSnapshot): boolean {
  const expected = new Set(
    inventory.entries.filter((entry) => entry.note && !entry.note.archived).map((entry) => entry.contentFingerprint),
  )
  const actual = new Set(request.chunks.map((chunk) => chunk.contentFingerprint))
  return (
    expected.size === actual.size &&
    [...expected].every((fingerprint) => typeof fingerprint === "string" && actual.has(fingerprint)) &&
    request.chunks.every((chunk) => validVector(chunk.vector, request.generation.dimensions)) &&
    contiguousChunks(request.chunks)
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
