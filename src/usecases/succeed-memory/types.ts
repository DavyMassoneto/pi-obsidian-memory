import type { Static } from "typebox"

import type { LifecycleRefusal, MemoryScope } from "#src/services"
import type { Succeeded } from "#src/shared"
import type { ChangeRefusal, PartialMemoryChange } from "#src/usecases/memory-change"
import type { SucceedMemoryRequestSchema } from "./schemas.ts"

export type SucceedMemoryRequest = Static<typeof SucceedMemoryRequestSchema>

export interface SucceededMemory {
  vault: MemoryScope
  path: string
  archivedPath: string
  successorPath: string
  maintenanceProblems: string[]
}

export type SucceedMemoryResult = Succeeded<SucceededMemory> | LifecycleRefusal | PartialMemoryChange | ChangeRefusal
