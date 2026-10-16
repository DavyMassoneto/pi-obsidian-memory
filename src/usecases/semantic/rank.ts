import {
  type CatalogEntry,
  type CatalogHit,
  cosine,
  fuseRankings,
  type MemoryConfig,
  MINIMUM_SIMILARITY,
  readIndexInventory,
  readVectorCache,
  type ScoredPath,
  type SearchIndex,
  semanticRanking,
  type VectorChunk,
} from "#src/services"
import { SEMANTIC_CANDIDATES } from "./constants.ts"
import type { QueryVector, SemanticRanked } from "./types.ts"

export function rankSemantically(
  index: SearchIndex,
  query: QueryVector,
  provider: MemoryConfig["embeddings"]["provider"],
): SemanticRanked {
  const inventory = readIndexInventory(index)
  const cache = readVectorCache(index)
  if (!inventory.succeeded) return { paths: [], hits: [], problems: inventory.problems }
  if (!cache.succeeded) return { paths: [], hits: [], problems: cache.problems }
  if (cache.output.generation?.fingerprint !== query.fingerprint) return { paths: [], hits: [], problems: [] }
  const similarity = similarityByContent(query, cache.output.chunks)
  const scored: ScoredPath[] = []
  const hits = new Map<string, CatalogHit>()
  for (const entry of inventory.output.entries) {
    const hit = hitOf(entry, similarity)
    if (!hit) continue
    scored.push({ path: entry.path, similarity: hit.score })
    hits.set(entry.path, hit)
  }
  const paths = semanticRanking(scored, MINIMUM_SIMILARITY[provider], SEMANTIC_CANDIDATES)
  return { paths, hits: paths.flatMap((path) => listed(hits.get(path))), problems: [] }
}

function similarityByContent(query: QueryVector, chunks: VectorChunk[]): Map<string, number> {
  const similarity = new Map<string, number>()
  for (const chunk of chunks) {
    const score = cosine(query.vector, chunk.vector)
    const best = similarity.get(chunk.contentFingerprint)
    if (typeof best !== "number" || score > best) similarity.set(chunk.contentFingerprint, score)
  }
  return similarity
}

function hitOf(entry: CatalogEntry, similarity: Map<string, number>): CatalogHit | null {
  const { note } = entry
  if (!note || note.archived || !entry.contentFingerprint) return null
  const score = similarity.get(entry.contentFingerprint)
  if (typeof score !== "number") return null
  return {
    path: entry.path,
    id: note.id,
    statement: note.statement,
    type: note.type,
    dontForget: note.dontForget,
    needsFixing: entry.needsFixing,
    score,
  }
}

function listed(hit: CatalogHit | undefined): CatalogHit[] {
  if (!hit) return []
  return [hit]
}

export function fuseSearchHits(text: CatalogHit[], semantic: SemanticRanked, limit: number): CatalogHit[] {
  const byPath = new Map<string, CatalogHit>()
  for (const hit of [...semantic.hits, ...text]) byPath.set(hit.path, hit)
  const fused = fuseRankings(
    text.map((hit) => hit.path),
    semantic.paths,
    limit,
  )
  return fused.flatMap((item) => {
    const hit = byPath.get(item.path)
    if (!hit) return []
    return [{ ...hit, score: item.score }]
  })
}
