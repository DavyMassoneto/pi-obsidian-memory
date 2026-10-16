import type { Static } from "typebox"

import type { LifecycleRefusal, MemoryScope } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { ChangeRefusal, PartialMemoryChange } from "#src/usecases/memory-change"
import type { ArchiveMemoryRequestSchema } from "./schemas.ts"

export type ArchiveMemoryRequest = Static<typeof ArchiveMemoryRequestSchema>

export interface ArchivedMemory {
  vault: MemoryScope
  path: string
  archivedPath: string
  maintenanceProblems: string[]
}

export type ArchiveMemoryResult = Succeeded<ArchivedMemory> | LifecycleRefusal | PartialMemoryChange | ChangeRefusal
