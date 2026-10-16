import type { VaultCatalogFailure } from "#src/domain"
import type { CatalogFailureDetail, CatalogOperation } from "./types.ts"

export function catalogFailure(detail: CatalogFailureDetail): VaultCatalogFailure {
  return { succeeded: false, path: detail.path, scope: detail.scope, reason: detail.reason, problems: [detail.problem] }
}

export function catalogIoFailure(error: Error, operation: CatalogOperation): VaultCatalogFailure {
  let reason: VaultCatalogFailure["reason"] = "io-error"
  if ("code" in error) {
    if (error.code === "ENOENT") reason = "not-found"
    if (error.code === "ENOTDIR") reason = "not-directory"
    if (error.code === "EACCES" || error.code === "EPERM" || error.code === "EBUSY") reason = "unreadable"
  }
  return catalogFailure({ ...operation, reason, problem: error.message })
}
