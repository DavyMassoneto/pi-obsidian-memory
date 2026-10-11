import { catalogFileKind, isCatalogHidden, isRootArchive, isRootTemplate } from "#/domain"
import { catalogFailure } from "./failures.ts"
import { resolveCatalogEntry } from "./resolve.ts"
import type { CatalogWalk, ResolvedCatalogEntry } from "./types.ts"

export async function visitCatalogEntry(walk: CatalogWalk, path: string): Promise<void> {
  const result = await resolveCatalogEntry({ root: walk.root, path })
  if (!result.succeeded) {
    walk.inventory.failures.push(result)
    return
  }

  const entry = result.output
  if (entry.canonicalPath !== path) {
    recordAlias(walk, path, entry)
    return
  }
  recordPhysicalEntry(walk, entry)
}

function recordPhysicalEntry(walk: CatalogWalk, entry: ResolvedCatalogEntry): void {
  const path = entry.canonicalPath
  if (entry.kind === "directory") {
    walk.inventory.entries.push({ path, kind: "folder", archived: isRootArchive(path), stat: entry.stat })
    if (walk.mode === "export" || !isRootTemplate(path)) walk.pending.push(path)
    return
  }
  if (entry.kind !== "file") {
    walk.inventory.failures.push(
      catalogFailure({ path, scope: "entry", reason: "not-file", problem: "Not a regular file or directory" }),
    )
    return
  }
  walk.inventory.entries.push({
    path,
    kind: catalogFileKind(path),
    archived: isRootArchive(path),
    stat: entry.stat,
  })
}

function recordAlias(walk: CatalogWalk, path: string, entry: ResolvedCatalogEntry): void {
  const target = entry.canonicalPath
  if (entry.kind === "directory" && (target === "" || path.startsWith(`${target}/`))) {
    walk.inventory.failures.push(
      catalogFailure({ path, scope: "directory", reason: "cycle", problem: "Directory alias leads to an ancestor" }),
    )
    return
  }
  if (isCatalogHidden(target)) {
    walk.inventory.failures.push(
      catalogFailure({ path, scope: "entry", reason: "excluded", problem: "Alias leads to a hidden path" }),
    )
    return
  }
  walk.inventory.aliases.push({ path, target })
}
