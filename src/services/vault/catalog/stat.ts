import type { Stats } from "node:fs"

import type { VaultFileStat } from "#src/domain"
import type { ResolvedCatalogEntry } from "./types.ts"

export function catalogStat(stats: Stats): VaultFileStat {
  return { size: stats.size, mtimeMs: stats.mtimeMs, ctimeMs: stats.ctimeMs, device: stats.dev, inode: stats.ino }
}

export function catalogEntryKind(stats: Stats): ResolvedCatalogEntry["kind"] {
  if (stats.isFile()) return "file"
  if (stats.isDirectory()) return "directory"
  return "other"
}

export function sameCatalogStat(left: VaultFileStat, right: VaultFileStat): boolean {
  return (
    left.size === right.size &&
    left.mtimeMs === right.mtimeMs &&
    left.ctimeMs === right.ctimeMs &&
    left.device === right.device &&
    left.inode === right.inode
  )
}
