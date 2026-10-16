import type { CatalogEntry, VectorChunk } from "#src/domain"
import { catalogEntryWithNote } from "./search-catalog.ts"

export const TEST_GENERATION = { fingerprint: "local/model/one", dimensions: 2 }

export function entryWithContent(name: string, archived: boolean): CatalogEntry {
  return { ...catalogEntryWithNote(`tools/${name}.md`, { archived }), contentFingerprint: `content-${name}` }
}

export function chunkFor(name: string, chunk: number, vector: number[]): VectorChunk {
  return { contentFingerprint: `content-${name}`, chunk, vector }
}
