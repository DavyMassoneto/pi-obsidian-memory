import type { CatalogHit, MemoryScope } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { MemoryResolutionRefusal } from "#src/usecases/resolve-memory"

export interface LoadedDontForgetNote {
  vault: MemoryScope
  path: string
  type: CatalogHit["type"]
  id: string
  hash: string
  statement: string
  body: string
  problems: string[]
}

export interface DontForgetVault {
  vault: MemoryScope
  notes: LoadedDontForgetNote[]
  problems: string[]
}

export interface LoadedDontForget {
  vaults: DontForgetVault[]
}

export type LoadDontForgetResult = Succeeded<LoadedDontForget> | MemoryResolutionRefusal
