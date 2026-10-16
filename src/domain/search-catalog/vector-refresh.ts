import type { CatalogEntry, VectorCache, VectorChunk, VectorRefreshPlan } from "./types.ts"

export function planVectorRefresh(
  entries: readonly CatalogEntry[],
  cache: VectorCache,
  providerFingerprint: string,
): VectorRefreshPlan {
  const current = new Map<string, CatalogEntry>()
  for (const entry of entries) {
    if (!entry.note || entry.note.archived || !entry.contentFingerprint) continue
    if (!current.has(entry.contentFingerprint)) current.set(entry.contentFingerprint, entry)
  }
  if (cache.generation?.fingerprint !== providerFingerprint) return { embed: [...current.values()], keep: [] }

  const keep: VectorChunk[] = cache.chunks.filter((chunk) => current.has(chunk.contentFingerprint))
  const cached = new Set(keep.map((chunk) => chunk.contentFingerprint))
  const embed: CatalogEntry[] = []
  for (const [fingerprint, entry] of current) {
    if (!cached.has(fingerprint)) embed.push(entry)
  }
  return { embed, keep }
}
