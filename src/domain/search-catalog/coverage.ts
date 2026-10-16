import type { CatalogScan } from "./types.ts"

export function catalogFolder(path: string): string {
  const slash = path.lastIndexOf("/")
  if (slash < 0) return ""
  return path.slice(0, slash)
}

export function retiredAliasPath(path: string, scan: CatalogScan): boolean {
  if (scan.failedPaths.some((failed) => failed === "" || path === failed || path.startsWith(`${failed}/`))) return false
  return (
    scan.excludedAliasFiles.includes(path) ||
    scan.untraversedAliasDirectories.some((alias) => path === alias || path.startsWith(`${alias}/`))
  )
}

export function confirmedMissing(path: string, scan: CatalogScan): boolean {
  if (scan.failedPaths.some((failed) => failed === "" || path === failed || path.startsWith(`${failed}/`))) return false
  if (scan.completeDirectories.includes(path)) return true
  if (scan.observedPaths.includes(path) || scan.entries.some((entry) => entry.path === path)) return false

  let child = path
  while (child !== "") {
    const folder = catalogFolder(child)
    if (scan.completeDirectories.includes(folder)) {
      return (
        !scan.observedPaths.some((seen) => seen === child || seen.startsWith(`${child}/`)) &&
        !scan.entries.some((entry) => entry.path === child || entry.path.startsWith(`${child}/`)) &&
        !scan.failedPaths.some((failed) => failed === child || failed.startsWith(`${child}/`))
      )
    }
    child = folder
  }
  return false
}
