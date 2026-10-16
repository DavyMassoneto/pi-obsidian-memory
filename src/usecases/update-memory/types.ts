import type { Static } from "typebox"

import type { MemoryScope, UpdateRefusal } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { ChangeRefusal } from "#src/usecases/memory-change"
import type { UpdateMemoryRequestSchema } from "./schemas.ts"

export type UpdateMemoryRequest = Static<typeof UpdateMemoryRequestSchema>

export interface UpdatedMemory {
  vault: MemoryScope
  path: string
  maintenanceProblems: string[]
}

export type UpdateMemoryResult = Succeeded<UpdatedMemory> | UpdateRefusal | ChangeRefusal
