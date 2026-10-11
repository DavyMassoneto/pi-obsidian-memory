import type { CatalogChanges, CatalogPlan, CatalogScan, CatalogSnapshot } from "#/domain"
import { planCatalogChanges } from "#/domain"
import type { CatalogQuery, CatalogSearchResult, IndexWriteResult, InventoryResult, SearchIndex } from "./types.ts"

export function readIndexInventory(index: SearchIndex): InventoryResult {
  return index.inventory()
}

export function applyIndexChanges(index: SearchIndex, changes: CatalogChanges): IndexWriteResult {
  return index.apply(changes)
}

export function searchCatalog(index: SearchIndex, request: CatalogQuery): CatalogSearchResult {
  return index.searchCatalog(request)
}

export function reconcileCatalog(snapshot: CatalogSnapshot, scan: CatalogScan): CatalogPlan {
  return planCatalogChanges(snapshot, scan)
}
