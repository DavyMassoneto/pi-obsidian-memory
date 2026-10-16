import type {
  FolderIndexState,
  FolderListingFingerprint,
  RefreshedFolder,
  VaultEnumeration,
  VaultFileStat,
} from "#src/services"

export function dirtyFolders(
  enumeration: VaultEnumeration,
  fingerprints: FolderListingFingerprint[],
  stored: FolderIndexState[],
): string[] {
  const states = new Map(stored.map((state) => [state.folder, state]))
  const indexStats = new Map<string, VaultFileStat>()
  for (const entry of enumeration.entries) {
    if (entry.kind === "index") indexStats.set(parentFolder(entry.path), entry.stat)
  }
  return fingerprints
    .filter(({ folder, fingerprint }) => {
      const state = states.get(folder)
      const stat = indexStats.get(folder)
      if (typeof fingerprint !== "string" || !state || !stat) return true
      return (
        state.fingerprint !== fingerprint ||
        state.indexSize !== stat.size ||
        state.indexMtimeMs !== stat.mtimeMs ||
        state.indexCtimeMs !== stat.ctimeMs ||
        state.indexIno !== String(stat.inode)
      )
    })
    .map(({ folder }) => folder)
}

export function settledStates(
  fingerprints: FolderListingFingerprint[],
  refreshed: RefreshedFolder[],
): FolderIndexState[] {
  const known = new Map(fingerprints.map(({ folder, fingerprint }) => [folder, fingerprint]))
  const states: FolderIndexState[] = []
  for (const { folder, index, settled } of refreshed) {
    const fingerprint = known.get(folder)
    if (!settled || typeof fingerprint !== "string") continue
    states.push({
      folder,
      fingerprint,
      indexSize: index.size,
      indexMtimeMs: index.mtimeMs,
      indexCtimeMs: index.ctimeMs,
      indexIno: String(index.inode),
    })
  }
  return states
}

function parentFolder(path: string): string {
  return path.slice(0, Math.max(path.lastIndexOf("/"), 0))
}
